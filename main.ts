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

const sharedSpherePosition = new BABYLON.Vector3(0, 1, 0); // Store the shared sphere's position

const createScene = async () => {
	const scene = new BABYLON.Scene(engine);
	Inspector.Show(scene, {});

	// Create an ArcRotateCamera
	const camera = new BABYLON.ArcRotateCamera(
		"camera",
		Math.PI / 2,
		Math.PI / 4,
		5,
		new BABYLON.Vector3(0, 0, 0),
		scene,
	);
	camera.attachControl(canvas, true);

	camera.alpha = -Math.PI / 2;
	camera.beta = Math.PI / 2;

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
	const desktopMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
	desktopMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // White color

	const desktopWidth = 10; // engine.getRenderWidth();
	const desktopHeight = 6; // engine.getRenderHeight();
	const desktop = BABYLON.MeshBuilder.CreatePlane(
		"desktop",
		{ width: desktopWidth, height: desktopHeight },
		scene,
	);
	desktop.material = desktopMaterial;

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

	// Define the plane at y = 1 (ground level)
	const plane = BABYLON.Plane.FromPositionAndNormal(
		new BABYLON.Vector3(0, 0, 0),
		new BABYLON.Vector3(0, 0, 0),
	);

	// Function to toggle between 2D and 3D based on the sphere's position relative to the plane
	function toggle2D3D(mesh, plane) {
		const distance = plane.signedDistanceTo(mesh.position);
		console.log("Distance to plane:", distance);
		if (
			mesh.position.x < desktopWidth / 2 + 1 &&
			mesh.position.x > -desktopWidth / 2 - 1 &&
			mesh.position.y < desktopHeight / 2 + 1 &&
			mesh.position.y > -desktopHeight / 2 - 1
		) {
			// Render as 2D (flatten Z-axis)
			mesh.scaling = new BABYLON.Vector3(1, 1, 0.001);
		} else {
			// Render as 3D
			mesh.scaling = new BABYLON.Vector3(1, 1, 1);
			mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
		}
	}

	// Set up VR experience
	const xrHelper = await scene.createDefaultXRExperienceAsync({
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

			// VR Controller interaction: Grab and move the shared sphere
			let grabbedMesh: BABYLON.AbstractMesh | null = null; // Store the grabbed mesh

			scene.onPointerObservable.add((pointerInfo) => {
				switch (pointerInfo.type) {
					case BABYLON.PointerEventTypes.POINTERDOWN:
						console.log("POINTER DOWN", pointerInfo);
						if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo?.pickedMesh) {
							// "Grab" it by attaching the picked mesh to the VR Controller
							if (xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
								// Check if 'pointerId' exists in the event
								if ("pointerId" in pointerInfo.event) {
									const pointerEvent = pointerInfo.event as PointerEvent;
									const xrInput =
										xrHelper.pointerSelection.getXRControllerByPointerId(
											pointerEvent.pointerId,
										);
									const motionController = xrInput?.motionController;
									if (motionController) {
										grabbedMesh = pointerInfo.pickInfo.pickedMesh;
										console.log("Grabbed mesh:", grabbedMesh);
										if (grabbedMesh.name === "sphere") {
											console.log("Shared Sphere is grabbed");
											grabbedMesh.setParent(motionController.rootMesh);
										}
									}
								} else {
									console.error("Event does not have pointerId");
								}
							} else {
								// here is the non-xr support
							}
						}
						break;

					case BABYLON.PointerEventTypes.POINTERUP:
						console.log("POINTER UP", pointerInfo);
						if (xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
							if ("pointerId" in pointerInfo.event) {
								const pointerEvent = pointerInfo.event as PointerEvent;
								const xrInput =
									xrHelper.pointerSelection.getXRControllerByPointerId(
										pointerEvent.pointerId,
									);
								const motionController = xrInput?.motionController;
								if (motionController) {
									if (grabbedMesh) {
										console.log("Released grabbed mesh:", grabbedMesh);
										grabbedMesh.setParent(null, true); // Keep world position when unparenting

										// Update sharedSpherePosition with the mesh's current position
										sharedSpherePosition.copyFrom(grabbedMesh.position);

										// Send position update to the server
										room.send("updatePosition", {
											x: grabbedMesh.position.x,
											y: grabbedMesh.position.y,
											z: grabbedMesh.position.z,
										});

										grabbedMesh = null; // Reset grabbed mesh
									}
								}
							} else {
								console.error("Event does not have pointerId");
							}
						} else {
							// here is the non-xr support
						}
						break;
				}
			}, BABYLON.PointerEventTypes.POINTERDOWN |
				BABYLON.PointerEventTypes.POINTERUP);

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
		})
		.catch((error) => {
			console.error("Couldn't connect:", error);
		});

	scene.registerBeforeRender(() => {
		// Smoothly interpolate the shared sphere's position
		sharedSphere.position = BABYLON.Vector3.Lerp(
			sharedSphere.position,
			sharedSpherePosition,
			0.05,
		);

		// Toggle between 2D and 3D based on the sphere's position relative to the plane
		toggle2D3D(sharedSphere, plane);
	});

	return scene;
};

const scene = await createScene();

// Run the render loop
engine.runRenderLoop(() => {
	scene.render();
});

// Resize the engine on window resize
window.addEventListener("resize", () => {
	engine.resize();
});
