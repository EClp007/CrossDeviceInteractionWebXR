import { Room, type Client } from "@colyseus/core";
import { MyRoomState, Player, SharedSphere } from "./schema/MyRoomState";
export class MyRoom extends Room<MyRoomState> {
	maxClients = 4;

	onCreate(options: any) {
		this.setState(new MyRoomState());

		this.onMessage("updatePosition", (client, data) => {
			const player = this.state.players.get(client.sessionId);
			player.x = data.x;
			player.y = data.y;
			player.z = data.z;

			// Also update the shared sphere's position
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
	}

	onJoin(client: Client, options: any) {
		console.log(client.sessionId, "joined!");

		// create Player instance
		const player = new Player();

		// place Player at a random position
		const FLOOR_SIZE = 500;
		player.x = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
		player.y = -(FLOOR_SIZE / 2) + Math.random() * FLOOR_SIZE;
		player.z = 0;

		// place player in the map of players by its sessionId
		// (client.sessionId is unique per connection!)
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
