import { Client, type Room } from "colyseus.js";
import * as BABYLON from "@babylonjs/core";

interface RoomState {
	sharedSphere: {
		x: number;
		y: number;
		z: number;
		onChange: (callback: () => void) => void;
	};
	desktop: {
		x: number;
		y: number;
		z: number;
		rotationX: number;
		rotationY: number;
		rotationZ: number;
		onChange: (callback: () => void) => void;
	};
}

export function setupNetworking(
	scene: BABYLON.Scene,
	sharedSphere: BABYLON.Mesh,
	desktop: BABYLON.Mesh,
	xrHelper: any,
) {
	const colyseusSDK = new Client(
		"wss://cross-device-interaction-webxr-d75c875bbe63.herokuapp.com",
	);

	colyseusSDK
		.joinOrCreate<RoomState>("my_room")
		.then((room: Room<RoomState>) => {
			console.log(`Connected to roomId: ${room.roomId}`);

			// Set up Colyseus state change handling for sharedSphere
			room.state.sharedSphere.onChange(() => {
				sharedSphere.position.set(
					room.state.sharedSphere.x,
					room.state.sharedSphere.y,
					room.state.sharedSphere.z,
				);
			});

			// Handle desktop transformations
			room.state.desktop.onChange(() => {
				desktop.position.set(
					room.state.desktop.x,
					room.state.desktop.y,
					room.state.desktop.z,
				);
				desktop.rotation.set(
					room.state.desktop.rotationX,
					room.state.desktop.rotationY,
					room.state.desktop.rotationZ,
				);
			});

			// Keyboard input event for sphere movement
			window.addEventListener("keydown", (event: KeyboardEvent) => {
				const speed = 0.03;
				const moveVector = new BABYLON.Vector3(0, 0, 0);

				switch (event.key) {
					case "w":
						moveVector.y += speed;
						break;
					case "s":
						moveVector.y -= speed;
						break;
					case "a":
						moveVector.x -= speed;
						break;
					case "d":
						moveVector.x += speed;
						break;
					default:
						return;
				}

				sharedSphere.position.addInPlace(moveVector);
				room.send("updatePosition", {
					x: sharedSphere.position.x,
					y: sharedSphere.position.y,
					z: sharedSphere.position.z,
				});
			});

			// Handle room disconnection
			room.onLeave((code) => {
				console.log("Disconnected from room.");
			});
		})
		.catch((error) => {
			console.error("Couldn't connect:", error);
		});
}
