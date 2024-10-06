import * as BABYLON from "@babylonjs/core";

export function createDesktop(
	scene: BABYLON.Scene,
	width: number,
	height: number,
): BABYLON.Mesh {
	const desktopMaterial = new BABYLON.StandardMaterial(
		"desktopMaterial",
		scene,
	);
	desktopMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);

	const desktop = BABYLON.MeshBuilder.CreatePlane(
		"desktop",
		{ width, height },
		scene,
	);
	desktop.material = desktopMaterial;
	desktop.position = new BABYLON.Vector3(0, 0, 0);

	return desktop;
}
