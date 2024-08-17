"use strict";
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
const tools_1 = require("@colyseus/tools");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
// Import Colyseus config
const app_config_1 = __importDefault(require("./app.config"));

// Create an Express app
const app = (0, express_1.default)();

// Serve a simple message at the root URL
app.get("/", (req, res) => {
	res.send("Welcome to the Colyseus Server");
});

// Create an HTTP server using the Express app
const server = http_1.default.createServer(app);

// Listen on 2567 (or PORT environment variable) using the Colyseus server and the HTTP server
(0, tools_1.listen)(app_config_1.default, server);

// Start the server on a specified port
const PORT = process.env.PORT || 2567;
server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
