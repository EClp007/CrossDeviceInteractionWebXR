import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
	@type("number") x: number;
	@type("number") y: number;
	@type("number") z: number;
}

export class SharedSphere extends Schema {
	@type("number") x = 0;

	@type("number") y = 0; // Start above the ground level

	@type("number") z = 0;
}

export class MyRoomState extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();

	@type(SharedSphere)
	sharedSphere = new SharedSphere();
}
