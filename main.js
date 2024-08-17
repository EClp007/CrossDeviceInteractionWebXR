import * as BABYLON from "@babylonjs/core";
import { Client } from "colyseus.js";
import "@babylonjs/loaders";

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

const sharedSpherePosition = new BABYLON.Vector3(0, 0, 0); // Store the shared sphere's position

const createScene = () => {
	const scene = new BABYLON.Scene(engine);

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

	// Add a ground
	const ground = BABYLON.MeshBuilder.CreateGround(
		"ground",
		{ width: 10, height: 10 },
		scene,
	);
	ground.receiveShadows = true;

	// Add a single shared sphere to cast shadows
	const sharedSphere = BABYLON.MeshBuilder.CreateSphere(
		"sphere",
		{ diameter: 2 },
		scene,
	);
	sharedSphere.position.y = 1;
	shadowGenerator.addShadowCaster(sharedSphere);

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

			// Player interaction: Click on the ground to change the position
			scene.onPointerDown = (event, pointer) => {
				if (event.button === 0 && pointer.pickedPoint) {
					const targetPosition = pointer.pickedPoint.clone();

					// Position adjustments for the current playground.
					targetPosition.y = -1; // Keep the sphere at ground level
					if (targetPosition.x > 245) targetPosition.x = 245;
					else if (targetPosition.x < -245) targetPosition.x = -245;
					if (targetPosition.z > 245) targetPosition.z = 245;
					else if (targetPosition.z < -245) targetPosition.z = -245;

					// Send position update to the server
					room.send("updatePosition", {
						x: targetPosition.x,
						y: targetPosition.y,
						z: targetPosition.z,
					});
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
	});

	return scene;
};

const scene = createScene();

// Run the render loop
engine.runRenderLoop(() => {
	scene.render();
});

// Resize the engine on window resize
window.addEventListener("resize", () => {
	engine.resize();
});
