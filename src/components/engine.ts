import * as BABYLON from "@babylonjs/core";

export function initializeEngine(canvasId: string): BABYLON.Engine {
	const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
	if (!canvas) {
		throw new Error("Canvas element not found");
	}
	return new BABYLON.Engine(canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
	});
}
