const { handleMessage, setServerState } = require("./websocket/handlers");

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { nanoid } = require("nanoid");

const app = express();

// Serve static in production
app.use(express.static("../client/vite-project/dist")); 

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// --- Matchmaking ---
const waitingPlayers = [];
const rooms = new Map();

// Broadcast to all in a room
function broadcastRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.forEach((player) => {
    if (player.readyState === WebSocket.OPEN) {
      player.send(JSON.stringify(message));
    }
  });
}

// Give handlers access to rooms, waitingPlayers, and broadcastRoom
setServerState({ rooms, waitingPlayers, broadcastRoom });

// Upgrade HTTP to WS
server.on("upgrade", (request, socket, head) => {
  if (request.url === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket connection
wss.on("connection", (ws) => {
  ws.id = nanoid(4);
  ws.roomId = null;
  console.log(`Player connected: ${ws.id}`);

  ws.send(JSON.stringify({
    type: "ASSIGN_ID",
    playerId: ws.id
  }));

  ws.on("message", async (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }
    await handleMessage(ws, data);
  });

  ws.on("close", () => {
    console.log(`Player disconnected: ${ws.id}`);
    // Remove from waiting queue
    const idx = waitingPlayers.indexOf(ws);
    if (idx !== -1) waitingPlayers.splice(idx, 1);

    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      const opponent = room.players.find(p => p !== ws);

      if (opponent && opponent.readyState === WebSocket.OPEN) {
        opponent.send(JSON.stringify({
          type: "GAME_END",
          winner: null,               
          message: "Opponent disconnected",  
          allowRematch: false         
        }));
        opponent.roomId = null;
      }

      if (room.timeInterval) clearInterval(room.timeInterval);

      rooms.delete(ws.roomId);
    }
  });
});

server.listen(8080, "0.0.0.0", () => {
  console.log("Backend + WS server running on http://localhost:8080");
});