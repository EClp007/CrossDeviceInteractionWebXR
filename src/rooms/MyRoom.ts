import { Room, type Client } from "@colyseus/core";
import {
	MyRoomState,
	Player,
	SharedSphere,
	Desktop,
} from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
	maxClients = 4;

	onCreate(options: any) {
		this.setState(new MyRoomState());

		// Handle position updates for the sphere
		this.onMessage("updatePosition", (client, data) => {
			const player = this.state.players.get(client.sessionId);
			if (player) {
				player.x = data.x;
				player.y = data.y;
				player.z = data.z;
			}

			// Update the shared sphere's position
			this.state.sharedSphere.x = data.x;
			this.state.sharedSphere.y = data.y;
			this.state.sharedSphere.z = data.z;

			// Broadcast the new sphere position to all clients
			this.broadcast("updateSpherePosition", {
				x: this.state.sharedSphere.x,
				y: this.state.sharedSphere.y,
				z: this.state.sharedSphere.z,
			});
		});

		// Handle updates for the desktop
		this.onMessage("updateDesktopTransform", (client, data) => {
			this.state.desktop.x = data.position.x;
			this.state.desktop.y = data.position.y;
			this.state.desktop.z = data.position.z;
			this.state.desktop.rotationX = data.rotation.x;
			this.state.desktop.rotationY = data.rotation.y;
			this.state.desktop.rotationZ = data.rotation.z;

			// Broadcast the desktop's updated position and rotation to all clients
			this.broadcast("updateDesktopTransform", {
				position: {
					x: this.state.desktop.x,
					y: this.state.desktop.y,
					z: this.state.desktop.z,
				},
				rotation: {
					x: this.state.desktop.rotationX,
					y: this.state.desktop.rotationY,
					z: this.state.desktop.rotationZ,
				},
			});
		});
	}

	onJoin(client: Client, options: any) {
		console.log(client.sessionId, "joined!");

		// Create a Player instance
		const player = new Player();

		// Place the Player at a random position
		const FLOOR_SIZE = 500;
		player.x = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
		player.y = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
		player.z = 0;

		// Place player in the map of players by its sessionId
		this.state.players.set(client.sessionId, player);
	}

	onLeave(client: Client, consented: boolean) {
		console.log(client.sessionId, "left!");
		this.state.players.delete(client.sessionId);
	}

	onDispose() {
		console.log("room", this.roomId, "disposing...");
	}
}
