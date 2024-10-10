# Cross-Reality Application with Babylon.js, WebXR, and Colyseus

## Overview

This project is a cross-reality application developed using **Babylon.js**, **WebXR**, and **Colyseus**. It allows the transmission of content within a cross-reality environment between an AR headset and a desktop.

## Technology Stack

- **Babylon.js**: For rendering 3D scenes and objects in WebGL.
- **WebXR**: To enable cross-device interactions and AR/VR functionalities.
- **Colyseus**: For multiplayer synchronization and server-client communication.
  
## Installation

To run this project locally, follow these steps:

1. **Clone the repository**:
    ```bash
    git clone https://github.com/crossDeviceInteractionWebXR/cross-device-app.git
    cd cross-device-app
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Run the development server**:
    ```bash
    npm run dev
    ```

4. **Open in browser**:
    - Open the application in a WebXR compatible browser, e.g., Chrome.

## Colyseus Server Setup

To enable real-time synchronization between devices, Colyseus is used for server-client communication. Follow these steps to deploy and connect the Colyseus server to your application:

1. **Deploy Colyseus**:
    - The Colyseus server implementation is available in this repository: [CrossDeviceInteractionWebXRColyseusServer](https://github.com/EClp007/CrossDeviceInteractionWebXRColyseusServer).
    - Deploy your Colyseus server by following the official [Colyseus deployment guide](https://docs.colyseus.io/colyseus/deployment/) for instructions on deploying to your chosen platform. 

2. **Update the Client in your Project**: Once your Colyseus server is live, update the WebSocket URL in your project to point to the deployed server. The client is located in the following file: [main.ts](https://github.com/EClp007/CrossDeviceInteractionWebXR/blob/main/src/scenes/main.ts)

     In this file, replace the WebSocket URL in the Colyseus client initialization with your server’s WebSocket URL:

     ```
    const colyseusSDK = new Client(
       "wss://your-colyseus-server-url"
     );
      ```


## Interactions

### 1. Edge-based Interaction
https://github.com/user-attachments/assets/2a659783-8158-4976-85b3-201221a14ffd

### 2. Portal Interaction
https://github.com/user-attachments/assets/519d74e3-ee3a-44dc-95cb-e658eac313a6

### 3. Drag-and-Drop Interaction
https://github.com/user-attachments/assets/99e79023-2769-4b59-a7c6-26b3023ffed5

## Acknowledgements

- [Babylon.js Documentation](https://doc.babylonjs.com/)
- [WebXR Documentation](https://immersive-web.github.io/webxr/)
- [Colyseus Documentation](https://docs.colyseus.io/)










