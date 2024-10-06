import * as BABYLON from "@babylonjs/core";

export const createLight = (scene: BABYLON.Scene): BABYLON.Light => {
	// Add a light
	const light = new BABYLON.HemisphericLight(
		"light",
		new BABYLON.Vector3(1, 1, 0),
		scene,
	);
	light.intensity = 0.7;
	return light;
};

export const createDirectionalLight = (
	scene: BABYLON.Scene,
): BABYLON.DirectionalLight => {
	// Add a directional light to create shadows
	const directionalLight = new BABYLON.DirectionalLight(
		"dirLight",
		new BABYLON.Vector3(-1, -2, -1),
		scene,
	);
	directionalLight.position = new BABYLON.Vector3(20, 40, 20);
	return directionalLight;
};
