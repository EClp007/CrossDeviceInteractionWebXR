import * as BABYLON from "@babylonjs/core";
import { Client } from "colyseus.js";
import "@babylonjs/loaders";
import {
	initializeEngine,
	createDesktop,
	createLight,
	createDirectionalLight,
	createPortalMesh,
} from "../components/index";
import * as GUI from "@babylonjs/gui";

const engine = initializeEngine("renderCanvas");

// Constants
const radiusSphere = 0.125;
const desktopWidth = 1.6;
const desktopHeight = 0.9;
const portalThreshold = 0.35;
const teleportThreshold = 0.08;
const rotationSpeed = 0.05; // Adjust as needed
const movementSpeed = 0.05; // Adjust as needed

// Global variables
let sharedSpherePosition = new BABYLON.Vector3(0, 1, 0); // Store the shared sphere's position
let isSphereGrabbed = false;
let grabbedMesh: BABYLON.AbstractMesh | null = null;
const leftThumbstickAxes = { x: 0, y: 0 };
let leftMotionController: BABYLON.WebXRAbstractMotionController | null = null;

let leftDeskopVector: BABYLON.Vector3 | null = null;
let upDeskopVector: BABYLON.Vector3 | null = null;
let desktopNormal: BABYLON.Vector3 | null = null;

let desktopMaterial: BABYLON.StandardMaterial | null = null;

let desktopBounds: {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
} | null = null;

let transformedCorners: BABYLON.Vector3[] = [];
let desktop: BABYLON.Mesh;

// Helper functions
function isInBounds(mesh: BABYLON.Mesh) {
	if (!desktopBounds) return false;
	return (
		mesh.position.x <= desktopBounds.maxX + radiusSphere &&
		mesh.position.x >= desktopBounds.minX - radiusSphere &&
		mesh.position.y <= desktopBounds.maxY + radiusSphere &&
		mesh.position.y >= desktopBounds.minY - radiusSphere &&
		mesh.position.z <= desktopBounds.maxZ + radiusSphere &&
		mesh.position.z >= desktopBounds.minZ - radiusSphere
	);
}

function calculate2DCoordinates(
	projectedPoint: BABYLON.Vector3,
	desktopCorners: BABYLON.Vector3[],
) {
	const u = desktopCorners[1].subtract(desktopCorners[0]);
	const v = desktopCorners[3].subtract(desktopCorners[0]);
	const w = projectedPoint.subtract(desktopCorners[0]);

	const uParam = BABYLON.Vector3.Dot(u, w) / BABYLON.Vector3.Dot(u, u);
	const vParam = BABYLON.Vector3.Dot(v, w) / BABYLON.Vector3.Dot(v, v);

	return { uParam, vParam };
}

// Function to toggle between 2D and 3D based on the sphere's position relative to the plane
function toggle2D3D(
	mesh: BABYLON.Mesh,
	projectedPoint: BABYLON.Vector3,
	distanceSphereToDesktop: number,
) {
	const renderAs3D = () => {
		mesh.scaling = new BABYLON.Vector3(1, 1, 1);
		mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
	};

	const renderAs2D = () => {
		const { uParam, vParam } = calculate2DCoordinates(
			projectedPoint,
			transformedCorners,
		);

		if (
			uParam >= 0 &&
			uParam <= 1 &&
			vParam >= 0 &&
			vParam <= 1 &&
			distanceSphereToDesktop > 0
		) {
			mesh.position = projectedPoint;
			mesh.scaling = new BABYLON.Vector3(1, 1, 0.1);
			mesh.rotation = desktop.rotation.clone();
			sharedSpherePosition.copyFrom(mesh.position);
		}

		if (isInBounds(mesh)) {
			mesh.position = projectedPoint;
			mesh.scaling = new BABYLON.Vector3(1, 1, 0.1);
			mesh.rotation = desktop.rotation.clone();
			sharedSpherePosition.copyFrom(mesh.position);
			(mesh.material as BABYLON.StandardMaterial).diffuseColor =
				new BABYLON.Color3(0, 1, 0);
		} else {
			renderAs3D();
		}
	};

	if (isSphereGrabbed) {
		renderAs3D();
	} else {
		renderAs2D();
	}
}

function checkPortalInteraction(
	portal: BABYLON.Mesh,
	middleOfDesktop: BABYLON.Vector3,
) {
	const distanceToPortal = BABYLON.Vector3.Distance(
		sharedSpherePosition,
		portal.position,
	);
	if (distanceToPortal < portalThreshold) {
		sharedSpherePosition = BABYLON.Vector3.Lerp(
			sharedSpherePosition,
			portal.position,
			0.1,
		);

		if (distanceToPortal < teleportThreshold) {
			sharedSpherePosition.copyFrom(middleOfDesktop);
			console.log("Sphere entered the portal!");
		}
	}
}

function calculateDesktopVectorsAndProjection(sharedSphere: BABYLON.Mesh) {
	// Calculate directional vectors of the desktop
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

	// Calculate the distance from the sphere center to the desktop plane
	const sphereCenter = sharedSphere.position;
	const normal = desktopNormal;
	const d = -BABYLON.Vector3.Dot(normal, desktop.position);

	const distanceSphereToDesktop = BABYLON.Vector3.Dot(normal, sphereCenter) + d;

	// Project the sphere's center point onto the desktop plane
	const projectedPoint = sphereCenter.subtract(
		normal.scale(distanceSphereToDesktop),
	);

	return {
		projectedPoint,
		distanceSphereToDesktop,
	};
}

// Create the scene
const createScene = async () => {
	const scene = new BABYLON.Scene(engine);

	// Setup lights and camera
	const light = createLight(scene);
	const directionalLight = createDirectionalLight(scene);
	const shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight);

	desktop = createDesktop(scene, desktopWidth, desktopHeight);

	// Create a FreeCamera
	const camera = new BABYLON.FreeCamera(
		"camera1",
		new BABYLON.Vector3(0, 0, -1.02),
		scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.inputs.clear();
	camera.parent = desktop;

	// Create sphere and its material
	const sphereMaterial = new BABYLON.StandardMaterial("sphereMaterial", scene);
	sphereMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Reddish color
	const sharedSphere = BABYLON.MeshBuilder.CreateSphere(
		"sphere",
		{ diameter: 2 * radiusSphere },
		scene,
	);
	sharedSphere.material = sphereMaterial; // Apply the material to the sphere
	sharedSphere.position = sharedSpherePosition.clone();
	shadowGenerator.addShadowCaster(sharedSphere);

	const portal = createPortalMesh(scene);


	const buttonMesh = BABYLON.MeshBuilder.CreateBox("button", { size: 0.2 }, scene);
    const buttonMaterial = new BABYLON.StandardMaterial("buttonMaterial", scene);
    buttonMaterial.diffuseColor = new BABYLON.Color3(0, 0.5, 0.8); // Blue color
    buttonMesh.material = buttonMaterial;

    // Position the button in front of the user
    buttonMesh.position = new BABYLON.Vector3(0, 1.5, 0.5); // Adjust position as needed

	// Set up VR experience
	const xrHelper = await scene.createDefaultXRExperienceAsync({
		uiOptions: {
			sessionMode: "immersive-ar",
		},
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
		desktop: {
			x: number;
			y: number;
			z: number;
			rotationX: number;
			rotationY: number;
			rotationZ: number;
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

			if (!room.state.desktop) {
				console.error("desktop is not initialized in the room state.");
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

			room.state.desktop.onChange(() => {
				// Update the Babylon.js desktop mesh position and rotation from Colyseus state
				desktop.position.set(
					room.state.desktop.x,
					room.state.desktop.y,
					room.state.desktop.z,
				);
				desktop.rotation.set(
					room.state.desktop.rotationX,
					room.state.desktop.rotationY,
					room.state.desktop.rotationZ,
				);
			});

			// Handle incoming updates from other clients correctly
			room.onMessage("updateDesktopTransform", (message) => {
				desktop.position.set(
					message.position.x,
					message.position.y,
					message.position.z,
				);
				desktop.rotation.set(
					message.rotation.x,
					message.rotation.y,
					message.rotation.z,
				);
				room.state.desktop.x = message.position.x;
				room.state.desktop.y = message.position.y;
				room.state.desktop.z = message.position.z;
				room.state.desktop.rotationX = message.rotation.x;
				room.state.desktop.rotationY = message.rotation.y;
				room.state.desktop.rotationZ = message.rotation.z;
			});
			room.onMessage("updatePosition", (message) => {
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
			// Move the sphere with the keyboard, depending if it's in 2D or 3D mode
			window.addEventListener("keydown", (event) => {
				const speed = 0.03; // Movement speed
				const isSphereIn2DMode = sharedSphere.scaling.z === 0.1;

				if (!isSphereGrabbed && leftDeskopVector && upDeskopVector) {
					let moveVector = BABYLON.Vector3.Zero();

					// Function to calculate move vector based on 2D or 3D mode
					const calculateMoveVector = (
						axisVector: BABYLON.Vector3,
						scalar: number,
					) => {
						if (isSphereIn2DMode) {
							moveVector = moveVector.add(axisVector.scale(scalar));
						}
						return moveVector.add(axisVector.scale(scalar));
					};

					switch (event.key.toLowerCase()) {
						case "w":
							moveVector = calculateMoveVector(upDeskopVector, speed);
							break;
						case "s":
							moveVector = calculateMoveVector(upDeskopVector, -speed);
							break;
						case "a":
							moveVector = calculateMoveVector(leftDeskopVector, -speed);
							break;
						case "d":
							moveVector = calculateMoveVector(leftDeskopVector, speed);
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

			// Click on the desktop to change the position of the shared sphere
			scene.onPointerDown = (event, pointer) => {
				if (event.button === 0 && pointer.pickedPoint) {
					const targetPosition = pointer.pickedPoint.clone();
					sharedSpherePosition.copyFrom(targetPosition);

					room.send("updatePosition", {
						x: targetPosition.x,
						y: targetPosition.y,
						z: targetPosition.z,
					});
				}
			};

			scene.onPointerObservable.add((pointerInfo) => {
				switch (pointerInfo.type) {
					// Grab the object when the pointer is down
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
									if (motionController && pointerInfo.pickInfo.pickedMesh !== buttonMesh) {
										grabbedMesh = pointerInfo.pickInfo.pickedMesh;
										grabbedMesh.setParent(motionController.rootMesh);
										if (grabbedMesh.name === "sphere") {
											isSphereGrabbed = true;
										}
									}
								}
								if (pointerInfo.pickInfo.pickedMesh === buttonMesh) {
									// Change the desktop color when the button is clicked
									desktopMaterial = new BABYLON.StandardMaterial("desktopMaterial", scene);
									desktopMaterial.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
									desktop.material = desktopMaterial;  // Apply the material to the desktop mesh
								}
							}
						}
						break;

					// Release the object when the pointer is up
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

								// When desktop position or rotation changes in AR
								room.send("updateDesktopTransform", {
									position: {
										x: desktop.position.x,
										y: desktop.position.y,
										z: desktop.position.z,
									},
									rotation: {
										x: desktop.rotation.x,
										y: desktop.rotation.y,
										z: desktop.rotation.z,
									},
								});
							} else if (grabbedMesh && grabbedMesh.name === "portal") {
								grabbedMesh.setParent(null);
								grabbedMesh = null;
							}
						}
						break;
				}
			}, BABYLON.PointerEventTypes.POINTERDOWN |
				BABYLON.PointerEventTypes.POINTERUP);

			scene.registerBeforeRender(() => {
				console.log("XR state:", xrHelper.baseExperience.state);
				if(xrHelper.baseExperience && xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
					desktop.material = desktopMaterial
					} else if (xrHelper.baseExperience && xrHelper.baseExperience.state === BABYLON.WebXRState.NOT_IN_XR) {

					}
			
				if (isSphereGrabbed) {
					// Update the sphere's material color when grabbed
					sphereMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1); // Blue color
				} else {
					// Update the sphere's material color when released
					sphereMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Reddish color
				}
				if (!isSphereGrabbed) {
					// Smoothly interpolate the shared sphere's position
					// TODO: lerping should be the same in 2d and 3d
					const lerpFactor = sharedSphere.scaling.z === 0.1 ? 1 : 0.05;
					sharedSphere.position = BABYLON.Vector3.Lerp(
						sharedSphere.position,
						sharedSpherePosition,
						lerpFactor,
					);
				} else {
					// Update sharedSpherePosition with the sphere's current position
					sharedSpherePosition.copyFrom(sharedSphere.getAbsolutePosition());
				}

				const halfWidth = desktopWidth / 2;
				const halfHeight = desktopHeight / 2;

				// Define desktop corners
				const corners = [
					new BABYLON.Vector3(-halfWidth, halfHeight, 0), // Top left
					new BABYLON.Vector3(halfWidth, halfHeight, 0), // Top right
					new BABYLON.Vector3(halfWidth, -halfHeight, 0), // Bottom right
					new BABYLON.Vector3(-halfWidth, -halfHeight, 0), // Bottom left
				];

				const worldMatrix = desktop.getWorldMatrix();
				transformedCorners = corners.map((corner) =>
					BABYLON.Vector3.TransformCoordinates(corner, worldMatrix),
				);

				// Initialize bounding values for the desktop
				desktopBounds = transformedCorners.reduce(
					(bounds, corner) => {
						bounds.minX = Math.min(bounds.minX, corner.x);
						bounds.maxX = Math.max(bounds.maxX, corner.x);
						bounds.minY = Math.min(bounds.minY, corner.y);
						bounds.maxY = Math.max(bounds.maxY, corner.y);
						bounds.minZ = Math.min(bounds.minZ, corner.z);
						bounds.maxZ = Math.max(bounds.maxZ, corner.z);
						return bounds;
					},
					{
						minX: Number.POSITIVE_INFINITY,
						maxX: Number.NEGATIVE_INFINITY,
						minY: Number.POSITIVE_INFINITY,
						maxY: Number.NEGATIVE_INFINITY,
						minZ: Number.POSITIVE_INFINITY,
						maxZ: Number.NEGATIVE_INFINITY,
					},
				);

				const { projectedPoint, distanceSphereToDesktop } =
					calculateDesktopVectorsAndProjection(sharedSphere);

				toggle2D3D(sharedSphere, projectedPoint, distanceSphereToDesktop);
				// animateMagnet(sharedSphere, distanceSphereToDesktop);

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
					const speed = 0.5;
					let moveVector = BABYLON.Vector3.Zero();

					if (
						sharedSphere.scaling.z === 0.1 &&
						leftDeskopVector &&
						upDeskopVector
					) {
						// The sphere is in 2D mode, move it along the desktop plane vectors
						moveVector = moveVector
							.add(leftDeskopVector.scale(leftThumbstickAxes.x * speed)) // Move left/right
							.add(upDeskopVector.scale(-leftThumbstickAxes.y * speed)); // Move up/down
					} else {
						// Handle other movement logic when not in 2D
						moveVector.x = leftThumbstickAxes.x * speed;
						moveVector.y = -leftThumbstickAxes.y * speed;
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
				checkPortalInteraction(portal, desktop.position);
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
