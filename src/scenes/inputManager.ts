import type * as BABYLON from "@babylonjs/core";

export function setupInput(
	scene: BABYLON.Scene,
	sharedSphere: BABYLON.Mesh,
	desktop: BABYLON.Mesh,
	xrHelper: any,
) {
	// Add VR controller inputs here
	xrHelper.input.onControllerAddedObservable.add(
		(controller: BABYLON.WebXRInputSource) => {
			controller.onMotionControllerInitObservable.add(
				(motionController: BABYLON.WebXRAbstractMotionController) => {
					if (motionController.handness === "left") {
						const thumbstickComponent = motionController.getComponent(
							"xr-standard-thumbstick",
						);

						thumbstickComponent.onAxisValueChangedObservable.add(
							(axes: { x: number; y: number }) => {
								// Handle movement via thumbstick axes
								sharedSphere.position.x += axes.x * 0.05;
								sharedSphere.position.y += axes.y * 0.05;
							},
						);
					}
				},
			);
		},
	);

	// Add pointer interaction logic for sphere and desktop
	scene.onPointerDown = (
		evt: BABYLON.IPointerEvent,
		pickInfo: BABYLON.PickingInfo,
		type: BABYLON.PointerEventTypes,
	) => {
		if (evt.button === 0 && pickInfo.pickedPoint) {
			sharedSphere.position = pickInfo.pickedPoint.clone();
		}
	};
}
