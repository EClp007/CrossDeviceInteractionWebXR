import { initializeEngine } from "../components/index";
import { createScene } from "./scene";

const engine = initializeEngine("renderCanvas");

(async () => {
	const scene = await createScene(engine);

	// Run the render loop
	engine.runRenderLoop(() => {
		scene.render();
	});

	// Resize the engine on window resize
	window.addEventListener("resize", () => {
		engine.resize();
	});
})();
