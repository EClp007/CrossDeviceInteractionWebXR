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

const playerEntities = {};
const playerNextPosition = {};

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

	// Add a sphere to cast shadows
	const sphere = BABYLON.MeshBuilder.CreateSphere(
		"sphere",
		{ diameter: 2 },
		scene,
	);
	sphere.position.y = 1;
	shadowGenerator.addShadowCaster(sphere);

	const colyseusSDK = new Client("ws://localhost:2567");
	colyseusSDK
		.joinOrCreate("my_room")
		.then((room) => {
			console.log(`Connected to roomId: ${room.roomId}`);

			room.state.players.onAdd((player, sessionId) => {
				// create player Sphere
				const sphere = BABYLON.MeshBuilder.CreateSphere(`player-${sessionId}`, {
					segments: 8,
					diameter: 40,
				});

				// set player spawning position
				sphere.position.set(player.x, player.y, player.z);

				// Check if the new player is the current player
				const isCurrentPlayer = sessionId === room.sessionId;
				sphere.material = new BABYLON.StandardMaterial(
					`player-material-${sessionId}`,
					scene,
				);

				if (isCurrentPlayer) {
					// highlight current player
					sphere.material.emissiveColor =
						BABYLON.Color3.FromHexString("#ff9900");
				} else {
					// other players are gray colored
					sphere.material.emissiveColor = BABYLON.Color3.Gray();
				}

				playerEntities[sessionId] = sphere;
				playerNextPosition[sessionId] = new BABYLON.Vector3(
					player.x,
					player.y,
					player.z,
				);
			});

			room.state.players.onRemove((player, sessionId) => {
				if (playerEntities[sessionId]) {
					playerEntities[sessionId].dispose();
					delete playerEntities[sessionId];
					delete playerNextPosition[sessionId];
				}
			});

			room.onMessage("updatePosition", (message) => {
				if (playerEntities[message.sessionId]) {
					playerNextPosition[message.sessionId] = new BABYLON.Vector3(
						message.x,
						message.y,
						message.z,
					);
				}
			});

			scene.onPointerDown = (event, pointer) => {
				if (event.button === 0 && pointer.pickedPoint) {
					const targetPosition = pointer.pickedPoint.clone();

					// Position adjustments for the current playground.
					targetPosition.y = -1;
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
		for (const sessionId in playerEntities) {
			const entity = playerEntities[sessionId];
			const targetPosition = playerNextPosition[sessionId];
			entity.position = BABYLON.Vector3.Lerp(
				entity.position,
				targetPosition,
				0.05,
			);
		}
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
