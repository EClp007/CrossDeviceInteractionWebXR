import * as BABYLON from "@babylonjs/core";
import { Client } from "colyseus.js"; // Ensure this import is correct for the colyseus library

const canvas = document.getElementById("renderCanvas");

if (!canvas) {
	console.error("Canvas element not found");
	throw new Error("Canvas element not found");
}

const engine = new BABYLON.Engine(canvas, true, {
	preserveDrawingBuffer: true,
	stencil: true,
});

const createScene = () => {
	const colyseusSDK = new Client("ws://localhost:2567");
	colyseusSDK
		.joinOrCreate("my_room")
		.then((room) => {
			console.log(`Connected to roomId: ${room.roomId}`);
		})
		.catch((error) => {
			console.error("Couldn't connect:", error);
		});

	const scene = new BABYLON.Scene(engine);
	// Add more scene setup code here if needed

	return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
	scene.render();
});

// Resize the engine on window resize
window.addEventListener("resize", () => {
	engine.resize();
});
