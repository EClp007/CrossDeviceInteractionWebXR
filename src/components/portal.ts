import * as BABYLON from "@babylonjs/core";

export const createPortalMesh = (scene: BABYLON.Scene) => {
	// Create the portal mesh
	const portal = BABYLON.MeshBuilder.CreateBox(
		"portal",
		{ width: 0.5, height: 0.5, depth: 0.1 },
		scene,
	);
	portal.position = new BABYLON.Vector3(1.5, 0, 0);

	// Create and configure the material for the portal
	const portalMaterial = new BABYLON.StandardMaterial("portalMaterial", scene);
	portalMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1);
	portalMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 1);
	portalMaterial.alpha = 0.8;
	portal.material = portalMaterial;

	// Create a glow effect around the portal
	const glowLayer = new BABYLON.GlowLayer("glow", scene);
	glowLayer.intensity = 1;

	// Create and apply a gradient texture to the portal
	const texture = new BABYLON.DynamicTexture(
		"dynamicTexture",
		{ width: 512, height: 512 },
		scene,
	);
	const ctx = texture.getContext();
	const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
	gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 512, 512);
	texture.update();
	portalMaterial.diffuseTexture = texture;

	return portal;
};
