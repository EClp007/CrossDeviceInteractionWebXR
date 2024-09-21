import * as BABYLON from "@babylonjs/core";
import { Client } from "colyseus.js";
import "@babylonjs/loaders";
import { Inspector } from "@babylonjs/inspector";

// Get the canvas element
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

if (!canvas) {
	console.error("Canvas element not found");
	throw new Error("Canvas element not found");
}

// Initialize the engine
const engine = new BABYLON.Engine(canvas, true, {
	preserveDrawingBuffer: true,
	stencil: true,
});

// Global variables
let sharedSpherePosition = new BABYLON.Vector3(0, 1, 0); // Store the shared sphere's position
let isSphereGrabbed = false;
let grabbedMesh: BABYLON.AbstractMesh | null = null;
const leftThumbstickAxes = { x: 0, y: 0 };
let leftMotionController: BABYLON.WebXRAbstractMotionController | null = null;

// Create the scene
const createScene = async () => {
	const scene = new BABYLON.Scene(engine);

	// Enable the Inspector
	Inspector.Show(scene, {});

	// Create a FreeCamera
	const camera = new BABYLON.FreeCamera(
		"camera1",
		new BABYLON.Vector3(0, 0, -6),
		scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.inputs.clear();

	// Add a light
	const light = new BABYLON.HemisphericLight(
		"light",
		new BABYLON.Vector3(1, 1, 0),
		scene,
	);
	light.intensity = 0.7;

	// Add a directional light to create shadows
	const directionalLight = new BABYLON.DirectionalLight(
		"dirLight",
		new BABYLON.Vector3(-1, -2, -1),
		scene,
	);
	directionalLight.position = new BABYLON.Vector3(20, 40, 20);

	// Enable shadows
	const shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight);

	// Create and add a colored material to the desktop
	const desktopMaterial = new BABYLON.StandardMaterial(
		"desktopMaterial",
		scene,
	);
	desktopMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // White color

	// Add a desktop plane (2D Surface)
	const desktopWidth = 10; // engine.getRenderWidth();
	const desktopHeight = 6; // engine.getRenderHeight();
	const desktop = BABYLON.MeshBuilder.CreatePlane(
		"desktop",
		{ width: desktopWidth, height: desktopHeight },
		scene,
	);
	desktop.material = desktopMaterial;

	const desktopPlaneZ = desktop.position.z;
	const proximityThreshold = 2; // Threshold distance to trigger the movement

	// Create and add a colored material to the ground
	const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
	groundMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.4); // Greenish color
	// Add a ground
	const ground = BABYLON.MeshBuilder.CreateGround(
		"ground",
		{ width: 10, height: 10 },
		scene,
	);
	ground.material = groundMaterial; // Apply the material to the ground
	ground.receiveShadows = true;
	ground.isVisible = false;

	// Create and add a colored material to the sphere
	const sphereMaterial = new BABYLON.StandardMaterial("sphereMaterial", scene);
	sphereMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Reddish color

	// Add a single shared sphere to cast shadows
	const sharedSphere = BABYLON.MeshBuilder.CreateSphere(
		"sphere",
		{ diameter: 2 },
		scene,
	);
	sharedSphere.material = sphereMaterial; // Apply the material to the sphere
	sharedSphere.position = sharedSpherePosition.clone();
	shadowGenerator.addShadowCaster(sharedSphere);

	// Function to toggle between 2D and 3D based on the sphere's position relative to the plane
	function toggle2D3D(mesh: BABYLON.Mesh) {
		const renderAs3D = () => {
			mesh.scaling = new BABYLON.Vector3(1, 1, 1);
			mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
		};

		if (isSphereGrabbed) {
			// Always render as 3D when the sphere is grabbed
			renderAs3D();
		} else if (
			mesh.position.x < desktopWidth / 2 + 1 &&
			mesh.position.x > -desktopWidth / 2 - 1 &&
			mesh.position.y < desktopHeight / 2 + 1 &&
			mesh.position.y > -desktopHeight / 2 - 1
		) {
			// Render as 2D (flatten Z-axis) when over the desktop plane
			mesh.scaling = new BABYLON.Vector3(1, 1, 0.001);
			mesh.position.z = desktopPlaneZ;
			sharedSpherePosition.z = desktopPlaneZ;
			mesh.rotation = new BABYLON.Vector3(0, 0, 0);
		} else {
			// Render as 3D
			renderAs3D();
		}
	}

	const portal = BABYLON.MeshBuilder.CreateBox(
		"portal",
		{ width: 2, height: 3 },
		scene,
	);
	portal.position = new BABYLON.Vector3(20, 1, 0);
	const portalMaterial = new BABYLON.StandardMaterial("portalMaterial", scene);
	portalMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1);
	portal.material = portalMaterial;

	// Function to check if the sphere is near the portal and "pull" it into the portal
	function checkPortalInteraction() {
		const distanceToPortal = BABYLON.Vector3.Distance(
			sharedSphere.position,
			portal.position,
		);
		const portalThreshold = 1.5; // Distance threshold to activate the portal pull

		// If the sphere is near the portal
		if (distanceToPortal < portalThreshold) {
			// Move the sphere smoothly toward the portal center
			sharedSpherePosition = BABYLON.Vector3.Lerp(
				sharedSphere.position,
				portal.position,
				0.1, // Smooth factor to control the speed of the pull
			);

			// once the sphere reaches the portal, teleport it
			if (distanceToPortal < 0.2) {
				sharedSphere.position = new BABYLON.Vector3(0, 1, 0);
				console.log("Sphere entered the portal!");
			}
		}
	}

	// Set up VR experience
	const xrHelper = await scene.createDefaultXRExperienceAsync({
		disableTeleportation: true,
		floorMeshes: [ground],
	});

	const colyseusSDK = new Client(
		"wss://cross-device-interaction-webxr-d75c875bbe63.herokuapp.com",
	);

	interface RoomState {
		sharedSphere: {
			x: number;
			y: number;
			z: number;
			onChange: (callback: () => void) => void;
		};
	}

	colyseusSDK
		.joinOrCreate<RoomState>("my_room")
		.then((room) => {
			console.log(`Connected to roomId: ${room.roomId}`);

			// Ensure sharedSphere exists in the state
			if (!room.state.sharedSphere) {
				console.error("sharedSphere is not initialized in the room state.");
				return;
			}

			// Safely attach the onChange listener
			room.state.sharedSphere.onChange(() => {
				// Update the position of the shared sphere
				sharedSpherePosition.set(
					room.state.sharedSphere.x,
					room.state.sharedSphere.y,
					room.state.sharedSphere.z,
				);
			});

			room.onMessage("updatePosition", (message) => {
				// Update the shared sphere position locally
				sharedSpherePosition.set(message.x, message.y, message.z);
				room.state.sharedSphere.x = message.x;
				room.state.sharedSphere.y = message.y;
				room.state.sharedSphere.z = message.z;
			});

			// on room disconnection
			room.onLeave((code) => {
				console.log("Disconnected from the room.");
			});

			// Keyboard input handling
			window.addEventListener("keydown", (event) => {
				const speed = 0.5; // Movement speed
				const moveVector = new BABYLON.Vector3(0, 0, 0);

				switch (event.key) {
					case "w":
					case "W":
						moveVector.y += speed;
						break;
					case "s":
					case "S":
						moveVector.y -= speed;
						break;
					case "a":
					case "A":
						moveVector.x -= speed;
						break;
					case "d":
					case "D":
						moveVector.x += speed;
						break;
					default:
						return; // Ignore other keys
				}

				const newPosition = sharedSpherePosition.add(moveVector);
				sharedSpherePosition.copyFrom(newPosition);

				// Send position update to the server
				room.send("updatePosition", {
					x: sharedSpherePosition.x,
					y: sharedSpherePosition.y,
					z: sharedSpherePosition.z,
				});
			});

			const rotationSpeed = 0.05; // Adjust as needed
			const movementSpeed = 0.05; // Adjust as needed

			xrHelper.input.onControllerAddedObservable.add((controller) => {
				controller.onMotionControllerInitObservable.add((motionController) => {
					if (motionController.handness === "left") {
						leftMotionController = motionController;
						const xr_ids = motionController.getComponentIds();
						const thumbstickComponent = motionController.getComponent(
							xr_ids[2],
						); // xr-standard-thumbstick

						thumbstickComponent.onAxisValueChangedObservable.add((axes) => {
							leftThumbstickAxes.x = axes.x;
							leftThumbstickAxes.y = axes.y;
						});
					}
				});
			});

			// Player interaction: Click on the ground to change the position
			scene.onPointerDown = (event, pointer) => {
				if (event.button === 0 && pointer.pickedPoint) {
					const targetPosition = pointer.pickedPoint.clone();

					// Send position update to the server
					room.send("updatePosition", {
						x: targetPosition.x,
						y: targetPosition.y,
						z: targetPosition.z,
					});
				} else {
					console.warn("Pointer did not hit any mesh or ground.");
				}
			};

			scene.onPointerObservable.add((pointerInfo) => {
				switch (pointerInfo.type) {
					case BABYLON.PointerEventTypes.POINTERDOWN:
						if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo?.pickedMesh) {
							if (xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
								if ("pointerId" in pointerInfo.event) {
									const pointerEvent = pointerInfo.event as PointerEvent;
									const xrInput =
										xrHelper.pointerSelection.getXRControllerByPointerId(
											pointerEvent.pointerId,
										);
									const motionController = xrInput?.motionController;
									if (motionController) {
										grabbedMesh = pointerInfo.pickInfo.pickedMesh;
										if (grabbedMesh.name === "sphere") {
											isSphereGrabbed = true;
											grabbedMesh.setParent(motionController.rootMesh);
										}
									}
								}
							}
						}
						break;

					case BABYLON.PointerEventTypes.POINTERUP:
						if (xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
							if (grabbedMesh && grabbedMesh.name === "sphere") {
								isSphereGrabbed = false;

								// Detach the sphere from the controller
								grabbedMesh.setParent(null);

								// Update sharedSpherePosition with the sphere's current position
								sharedSpherePosition.copyFrom(
									grabbedMesh.getAbsolutePosition(),
								);

								// Send position update to the server
								room.send("updatePosition", {
									x: sharedSpherePosition.x,
									y: sharedSpherePosition.y,
									z: sharedSpherePosition.z,
								});

								grabbedMesh = null;
							}
						}
						break;
				}
			}, BABYLON.PointerEventTypes.POINTERDOWN |
				BABYLON.PointerEventTypes.POINTERUP);

			scene.registerBeforeRender(() => {
				if (!isSphereGrabbed) {
					// Smoothly interpolate the shared sphere's position
					sharedSphere.position = BABYLON.Vector3.Lerp(
						sharedSphere.position,
						sharedSpherePosition,
						0.05,
					);
				} else {
					// Update sharedSpherePosition with the sphere's current position
					sharedSpherePosition.copyFrom(sharedSphere.getAbsolutePosition());
				}

				checkPortalInteraction();

				// Check if the sphere is near the desktop plane
				if (
					!isSphereGrabbed &&
					Math.abs(sharedSphere.position.z - desktopPlaneZ) <
						proximityThreshold &&
					Math.abs(sharedSphere.position.x) <
						desktopWidth / 2 + proximityThreshold &&
					Math.abs(sharedSphere.position.y) <
						desktopHeight / 2 + proximityThreshold
				) {
					// Move the sphere onto the desktop plane frame by frame
					sharedSpherePosition.z = desktopPlaneZ;
					sharedSphere.position.z = desktopPlaneZ;

					// Optionally adjust x and y to align with the desktop
					sharedSpherePosition.x = Math.max(
						-desktopWidth / 2,
						Math.min(sharedSpherePosition.x, desktopWidth / 2),
					);
					sharedSpherePosition.y = Math.max(
						-desktopHeight / 2,
						Math.min(sharedSpherePosition.y, desktopHeight / 2),
					);
				}

				// Toggle between 2D and 3D based on the sphere's position relative to the plane
				toggle2D3D(sharedSphere);

				// Continuous movement for the grabbed sphere
				if (isSphereGrabbed && grabbedMesh && grabbedMesh.name === "sphere") {
					if (
						leftMotionController &&
						(leftThumbstickAxes.x !== 0 || leftThumbstickAxes.y !== 0)
					) {
						// Rotate the sphere around its local Y-axis
						grabbedMesh.rotation.y += leftThumbstickAxes.x * rotationSpeed;

						// Get the controller's forward vector
						const controllerForward = new BABYLON.Vector3(0, 0, 1); // Local forward vector
						const controllerRotationQuaternion =
							leftMotionController.rootMesh?.rotationQuaternion;

						if (controllerRotationQuaternion) {
							// Transform to world coordinates
							const worldMatrix = new BABYLON.Matrix();
							controllerRotationQuaternion.toRotationMatrix(worldMatrix);
							const worldForward = BABYLON.Vector3.TransformNormal(
								controllerForward,
								worldMatrix,
							).normalize();

							// Move along the forward vector
							const movementVector = worldForward.scale(
								leftThumbstickAxes.y * movementSpeed,
							);

							// Update the sphere's position
							grabbedMesh.position.addInPlace(movementVector);

							// Update sharedSpherePosition
							sharedSpherePosition.copyFrom(grabbedMesh.getAbsolutePosition());

							// Send position and rotation update to the server
							room.send("updatePosition", {
								x: sharedSpherePosition.x,
								y: sharedSpherePosition.y,
								z: sharedSpherePosition.z,
							});
						} else {
							console.warn("Controller's RotationQuaternion is not available.");
						}
					}
				} else if (leftThumbstickAxes.x !== 0 || leftThumbstickAxes.y !== 0) {
					// Move the sphere when it's not grabbed
					const speed = 0.5;
					const moveVector = new BABYLON.Vector3(0, 0, 0);
					moveVector.x += leftThumbstickAxes.x * speed;
					moveVector.y -= leftThumbstickAxes.y * speed;
					const newPosition = sharedSpherePosition.add(moveVector);
					sharedSpherePosition.copyFrom(newPosition);

					// Send position update to the server
					room.send("updatePosition", {
						x: sharedSpherePosition.x,
						y: sharedSpherePosition.y,
						z: sharedSpherePosition.z,
					});
				}
			});
		})
		.catch((error) => {
			console.error("Couldn't connect:", error);
		});

	return scene;
};

(async () => {
	const scene = await createScene();

	// Run the render loop
	engine.runRenderLoop(() => {
		scene.render();
	});

	// Resize the engine on window resize
	window.addEventListener("resize", () => {
		engine.resize();
	});
})();
