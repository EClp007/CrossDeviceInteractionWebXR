import * as BABYLON from "@babylonjs/core";

import {
	createLight,
	createDirectionalLight,
	createDesktop,
	createPortalMesh,
} from "../components/index.ts";
import { setupNetworking } from "./network.ts";
import { setupInput } from "./inputManager.ts";
import { checkPortalInteraction, toggle2D3D } from "./utils.ts";

export const createScene = async (engine: BABYLON.Engine) => {
	const scene = new BABYLON.Scene(engine);

	// Add light and directional light
	const light = createLight(scene);
	const directionalLight = createDirectionalLight(scene);

	// Set up shadow generator
	const shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight);

	// Create desktop
	const desktopWidth = 1.6;
	const desktopHeight = 0.9;
	const desktop = createDesktop(scene, desktopWidth, desktopHeight);

	// Create camera
	const camera = new BABYLON.FreeCamera(
		"camera1",
		new BABYLON.Vector3(0, 0, -1.02),
		scene,
	);
	camera.setTarget(BABYLON.Vector3.Zero());
	camera.inputs.clear();
	camera.parent = desktop;

	// Create sphere material and shared sphere
	const sphereMaterial = new BABYLON.StandardMaterial("sphereMaterial", scene);
	sphereMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Reddish color
	const radiusSphere = 0.125;
	const sharedSphere = BABYLON.MeshBuilder.CreateSphere(
		"sphere",
		{ diameter: 2 * radiusSphere },
		scene,
	);
	sharedSphere.material = sphereMaterial; // Apply the material
	shadowGenerator.addShadowCaster(sharedSphere);

	// Create portal
	const portal = createPortalMesh(scene);

	// Setup VR experience
	const xrHelper = await scene.createDefaultXRExperienceAsync({
		uiOptions: { sessionMode: "immersive-ar" },
	});

	// Setup networking (Colyseus)
	//setupNetworking(scene, sharedSphere, desktop, xrHelper);

	// Setup input management
	setupInput(scene, sharedSphere, desktop, xrHelper);

	// Register rendering logic
	scene.registerBeforeRender(() => {
		setupNetworking(scene, sharedSphere, desktop, xrHelper);
		// Add your game logic here, including sphere movement, interaction, etc.
		toggle2D3D(sharedSphere, desktop);
		checkPortalInteraction(sharedSphere, portal);
	});

	return scene;
};
