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

let leftDeskopVector: BABYLON.Vector3 | null = null;
let upDeskopVector: BABYLON.Vector3 | null = null;
let desktopNormal: BABYLON.Vector3 | null = null;

// Create the scene
const createScene = async () => {
	const scene = new BABYLON.Scene(engine);

	// Enable the Inspector
	Inspector.Show(scene, {});

	// Create a FreeCamera
	const camera = new BABYLON.FreeCamera(
		"camera1",
		new BABYLON.Vector3(0, 0, -20),
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

	// Function to project the mesh onto a specific side of the desktop plane
	function projectOntoDesktop(
		mesh: BABYLON.Mesh,
		desktopNormal: BABYLON.DeepImmutableObject<BABYLON.Vector3>,
		planeToItem: BABYLON.DeepImmutableObject<BABYLON.Vector3>,
		desiredSide = "back",
	) {
		// Calculate the projection distance
		let dotProduct = BABYLON.Vector3.Dot(planeToItem, desktopNormal);

		// Check the current side of the mesh relative to the desktop
		if (desiredSide === "front" && dotProduct > 0) {
			// If the mesh is on the "back" side, invert the dotProduct to project to the "front"
			dotProduct = Math.abs(dotProduct);
		} else if (desiredSide === "back" && dotProduct < 0) {
			// If the mesh is on the "front" side, invert the dotProduct to project to the "back"
			dotProduct = -Math.abs(dotProduct);
		}

		// Calculate the projection vector
		const projection = desktopNormal.scale(dotProduct);

		// Calculate the new projected position
		const newPosition = mesh.position.subtract(projection);

		return newPosition;
	}

	// Function to toggle between 2D and 3D based on the sphere's position relative to the plane
	// Updated toggle2D3D function with rotation that matches the desktop
	function toggle2D3D(mesh: BABYLON.Mesh) {
		const renderAs3D = () => {
			mesh.scaling = new BABYLON.Vector3(1, 1, 1);
			mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
		};

		if (isSphereGrabbed) {
			// Always render as 3D when the sphere is grabbed
			renderAs3D();
		} else {
			// Calculate the current position of the desktop
			const halfWidth = desktopWidth / 2;
			const halfHeight = desktopHeight / 2;

			const corners = [
				new BABYLON.Vector3(-halfWidth, halfHeight, 0), // Oben links
				new BABYLON.Vector3(halfWidth, halfHeight, 0), // Oben rechts
				new BABYLON.Vector3(halfWidth, -halfHeight, 0), // Unten rechts
				new BABYLON.Vector3(-halfWidth, -halfHeight, 0), // Unten links
			];

			const worldMatrix = desktop.getWorldMatrix();
			const transformedCorners = corners.map((corner) =>
				BABYLON.Vector3.TransformCoordinates(corner, worldMatrix),
			);

			let minX = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;
			let minZ = Number.POSITIVE_INFINITY;
			let maxZ = Number.NEGATIVE_INFINITY;

			for (const corner of transformedCorners) {
				if (corner.x < minX) minX = corner.x;
				if (corner.x > maxX) maxX = corner.x;
				if (corner.y < minY) minY = corner.y;
				if (corner.y > maxY) maxY = corner.y;
				if (corner.z < minZ) minZ = corner.z;
				if (corner.z > maxZ) maxZ = corner.z;
			}

			const desktopBounds = {
				minX,
				maxX,
				minY,
				maxY,
				minZ,
				maxZ,
			};

			console.log(desktopBounds);

			// Set a threshold for "direct" proximity
			const threshold = 0.9; // Sensitivity threshold
			const distanceLimit = 30; // Maximum distance to be considered "near"

			// Calculate the directional vectors of the desktop, taking rotation into account
			desktopNormal = BABYLON.Vector3.TransformNormal(
				BABYLON.Axis.Z,
				desktop.getWorldMatrix(),
			).normalize(); // Normal vector of the desktop (forward)
			upDeskopVector = BABYLON.Vector3.TransformNormal(
				BABYLON.Axis.Y,
				desktop.getWorldMatrix(),
			).normalize(); // Upward direction of the desktop
			leftDeskopVector = BABYLON.Vector3.Cross(
				upDeskopVector,
				desktopNormal,
			).normalize(); // Left directional vector of the desktop

			// Get the world matrix of the desktop and invert it to transform to local space
			const inverseDesktopMatrix = desktop.getWorldMatrix().clone().invert();

			// Transform the mesh position into the desktop's local space
			const meshLocalPosition = BABYLON.Vector3.TransformCoordinates(
				mesh.position,
				inverseDesktopMatrix,
			);

			// Since we're now in local space, subtract the desktop's local position (which is essentially (0, 0, 0) in this frame)
			const planeToItem = meshLocalPosition; // This is now the vector from the desktop to the mesh in the desktop's local space

			// Calculate the dot products
			const leftDotProduct = BABYLON.Vector3.Dot(planeToItem, leftDeskopVector);
			const frontDotProduct = BABYLON.Vector3.Dot(planeToItem, desktopNormal);
			const upDotProduct = BABYLON.Vector3.Dot(planeToItem, upDeskopVector);

			// Check if the mesh is directly above the desktop
			const isDirectlyOverDesktop =
				Math.abs(leftDotProduct) < threshold &&
				Math.abs(frontDotProduct) < threshold &&
				upDotProduct > 0 &&
				upDotProduct <= distanceLimit;

			console.log("isDieectlyOverDesktop", isDirectlyOverDesktop);

			// Check if the mesh is directly below the desktop
			const isDirectlyUnderDesktop =
				Math.abs(leftDotProduct) < threshold &&
				Math.abs(frontDotProduct) < threshold &&
				upDotProduct < 0 &&
				Math.abs(upDotProduct) <= distanceLimit;

			console.log("isDirectlyUnderDesktop", isDirectlyUnderDesktop);

			// Check if the mesh is directly on the left or right side of the desktop
			const isDirectlyOnSide =
				Math.abs(frontDotProduct) < threshold &&
				Math.abs(upDotProduct) < threshold &&
				Math.abs(leftDotProduct) <= distanceLimit;

			console.log("isDirectlyOnSide", isDirectlyOnSide);

			console.log(
				"meshPosition",
				mesh.position.x < desktopBounds.maxX &&
					mesh.position.x > desktopBounds.minX &&
					mesh.position.y < desktopBounds.maxY &&
					mesh.position.y > desktopBounds.minY,
			);

			// Check if the sphere is within the boundaries of the desktop or within the defined limits
			if (
				(mesh.position.x < desktopBounds.maxX &&
					mesh.position.x > desktopBounds.minX &&
					mesh.position.y < desktopBounds.maxY &&
					mesh.position.y > desktopBounds.minY) ||
				isDirectlyOverDesktop ||
				isDirectlyUnderDesktop ||
				isDirectlyOnSide
			) {
				// Project the sphere's position onto the desktop's plane
				const projection = desktopNormal.scale(
					BABYLON.Vector3.Dot(planeToItem, desktopNormal),
				);
				const newPosition = projectOntoDesktop(
					mesh,
					desktopNormal,
					planeToItem,
					"back",
				);

				// Set the new position for the sphere
				mesh.position = newPosition;
				sharedSpherePosition.copyFrom(mesh.position);

				// Set the mesh to 2D scaling
				mesh.scaling = new BABYLON.Vector3(1, 1, 0.1);

				// Apply the desktop's rotation to the mesh
				mesh.rotation = desktop.rotation.clone();
			} else {
				// Otherwise, render as 3D
				renderAs3D();
			}
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

				if (
					!isSphereGrabbed &&
					sharedSphere.scaling.z === 0.1 &&
					leftDeskopVector &&
					upDeskopVector
				) {
					// Ensure the vectors are available and the sphere is in 2D mode
					let moveVector = BABYLON.Vector3.Zero();

					switch (event.key) {
						case "w":
						case "W":
							moveVector = moveVector.add(upDeskopVector.scale(speed));
							break;
						case "s":
						case "S":
							moveVector = moveVector.add(upDeskopVector.scale(-speed));
							break;
						case "a":
						case "A":
							moveVector = moveVector.add(leftDeskopVector.scale(-speed));
							break;
						case "d":
						case "D":
							moveVector = moveVector.add(leftDeskopVector.scale(speed));
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
				} else {
					// Ensure the vectors are available and the sphere is in 2D mode
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
						case "e":
						case "E":
							moveVector.z += speed;
							break;
						case "r":
						case "R":
							moveVector.z -= speed;
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
				}
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
										if (grabbedMesh.name === "desktop") {
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
							} else if (grabbedMesh && grabbedMesh.name === "desktop") {
								grabbedMesh.setParent(null);
								grabbedMesh = null;
							}
						}
						break;
				}
			}, BABYLON.PointerEventTypes.POINTERDOWN |
				BABYLON.PointerEventTypes.POINTERUP);

			scene.registerBeforeRender(() => {
				if (isSphereGrabbed) {
					// Update the sphere's material color when grabbed
					sphereMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1); // Blue color
				} else {
					// Update the sphere's material color when released
					sphereMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Reddish color
				}
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

				// checkPortalInteraction();

				// Check if the sphere is near the desktop plane
				/*
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
				}*/

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
					if (
						sharedSphere.scaling.z === 0.1 &&
						leftDeskopVector &&
						upDeskopVector
					) {
						// The sphere is in 2D mode, move it along the desktop plane vectors
						const speed = 0.5;
						let moveVector = BABYLON.Vector3.Zero();

						moveVector = moveVector
							.add(leftDeskopVector.scale(leftThumbstickAxes.x * speed)) // Move left/right
							.add(upDeskopVector.scale(-leftThumbstickAxes.y * speed)); // Move up/down

						const newPosition = sharedSpherePosition.add(moveVector);
						sharedSpherePosition.copyFrom(newPosition);

						// Send position update to the server
						room.send("updatePosition", {
							x: sharedSpherePosition.x,
							y: sharedSpherePosition.y,
							z: sharedSpherePosition.z,
						});
					} else {
						// Handle other movement logic when not in 2D
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
