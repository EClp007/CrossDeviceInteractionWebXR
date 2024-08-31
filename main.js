import * as BABYLON from "@babylonjs/core";
import { Client } from "colyseus.js";
import "@babylonjs/loaders";
import { Inspector } from "@babylonjs/inspector";

// Get the canvas element
const canvas = document.getElementById("renderCanvas");

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

const createScene = () => {
	const scene = new BABYLON.Scene(engine);
	Inspector.Show(scene, {});

	// Create an ArcRotateCamera
	const camera = new BABYLON.ArcRotateCamera(
		"camera",
		Math.PI / 2,
		Math.PI / 4,
		10,
		new BABYLON.Vector3(0, 0, 0),
		scene,
	);
	camera.attachControl(canvas, true);

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

	// Create and add a colored material to the ground
	const desktopMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
	desktopMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // Greenish color

	const desktopWidth = 10;
	const desktopHeight = 6;
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
	sharedSphere.position.y = 0;
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
		if (mesh.position.x < 6) {
			// Render as 2D (flatten Z-axis)
			mesh.scaling = new BABYLON.Vector3(1, 1, 0.01);
			mesh.position.y = 0; // Keep the sphere at ground level
		} else {
			// Render as 3D
			mesh.scaling = new BABYLON.Vector3(1, 1, 1);
			mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
		}
	}

	// Set up VR experience
	const vrHelper = scene.createDefaultXRExperienceAsync({
		createDeviceOrientationCamera: false,
		trackPosition: true,
		laserToggle: true,
		controllers: {
			left: {
				onPointerDownObservable: (event) => {
					handlePointerDown(event, scene, ground, sharedSpherePosition);
				},
			},
			right: {
				onPointerDownObservable: (event) => {
					handlePointerDown(event, scene, ground, sharedSpherePosition);
				},
			},
		},
	});

	const colyseusSDK = new Client(
		"wss://cross-device-interaction-webxr-d75c875bbe63.herokuapp.com",
	);

	colyseusSDK
		.joinOrCreate("my_room")
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
					room.state.sharedSphere.y, // Keep the sphere at ground level
					0,
				);
			});

			room.onMessage("updatePosition", (message) => {
				// Update the shared sphere position locally
				sharedSpherePosition.set(message.x, 1, message.z);
				room.state.sharedSphere.x = message.x;
				room.state.sharedSphere.y = message.y; // Ensure it stays on the ground
				room.state.sharedSphere.z = 0;
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

				// Position adjustments for the current playground.
				/*
				if (sharedSpherePosition.x > 5) sharedSpherePosition.x = 5;
				else if (sharedSpherePosition.x < -5) sharedSpherePosition.x = -5;
				if (sharedSpherePosition.z > 5) sharedSpherePosition.z = 5;
				else if (sharedSpherePosition.z < -5) sharedSpherePosition.z = -5;*/

				// Send position update to the server
				room.send("updatePosition", {
					x: sharedSpherePosition.x,
					y: sharedSpherePosition.y,
					z: 0, // Ensure it stays on the ground
				});
			});

			// Player interaction: Click on the ground to change the position
			scene.onPointerDown = (event, pointer) => {
				if (event.button === 0 && pointer.pickedPoint) {
					const targetPosition = pointer.pickedPoint.clone();

					// Position adjustments for the current playground.
					/*targetPosition.y = 0; // Keep the sphere at ground level
					if (targetPosition.x > 5) targetPosition.x = 5;
					else if (targetPosition.x < -5) targetPosition.x = -5;
					if (targetPosition.z > 5) targetPosition.z = 5;
					else if (targetPosition.z < -5) targetPosition.z = -5;*/

					// Send position update to the server
					room.send("updatePosition", {
						x: targetPosition.x,
						y: targetPosition.y,
						z: 0, // Ensure it stays on the ground
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

// Function to handle pointer down events in VR
function handlePointerDown(event, scene, ground, sharedSpherePosition) {
	const pickInfo = scene.pick(
		scene.pointerX,
		scene.pointerY,
		(mesh) => mesh === desktop,
	);
	if (pickInfo.hit) {
		const targetPosition = pickInfo.pickedPoint.clone();

		// Position adjustments for the current playground.
		/*targetPosition.y = 0; // Keep the sphere at ground level
		if (targetPosition.x > 5) targetPosition.x = 5;
		else if (targetPosition.x < -5) targetPosition.x = -5;
		if (targetPosition.z > 5) targetPosition.z = 5;
		else if (targetPosition.z < -5) targetPosition.z = -5;*/

		// Update the sharedSpherePosition
		sharedSpherePosition.copyFrom(targetPosition);

		// Send position update to the server
		room.send("updatePosition", {
			x: targetPosition.x,
			y: targetPosition.y, // Ensure it stays on the ground
			z: targetPosition.z,
		});
	}
}

const scene = createScene();

// Run the render loop
engine.runRenderLoop(() => {
	scene.render();
});

// Resize the engine on window resize
window.addEventListener("resize", () => {
	engine.resize();
});
