import * as BABYLON from "@babylonjs/core";

export function toggle2D3D(sharedSphere: BABYLON.Mesh, desktop: BABYLON.Mesh) {
	// Logic to toggle between 2D/3D based on the sphere's position relative to the desktop
	const distanceToDesktop = BABYLON.Vector3.Distance(
		sharedSphere.position,
		desktop.position,
	);
	if (distanceToDesktop < 1.0) {
		sharedSphere.scaling.z = 0.1; // Flatten for 2D mode
	} else {
		sharedSphere.scaling.z = 1.0; // Normal scaling for 3D mode
	}
}

export function checkPortalInteraction(
	sharedSphere: BABYLON.Mesh,
	portal: BABYLON.Mesh,
) {
	const distanceToPortal = BABYLON.Vector3.Distance(
		sharedSphere.position,
		portal.position,
	);
	if (distanceToPortal < 0.35) {
		sharedSphere.position = BABYLON.Vector3.Lerp(
			sharedSphere.position,
			portal.position,
			0.1,
		);
		if (distanceToPortal < 0.08) {
			console.log("Sphere entered the portal!");
		}
	}
}
