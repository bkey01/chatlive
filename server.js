const express = require("express");
const http = require("http");
const WebSocket = require("websocket").server;  // Gunakan websocket dari npm
const axios = require("axios");  // Import Axios
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocket({ httpServer: server });

app.use(express.static("."));

wsServer.on("request", async (request) => {
    const connection = request.accept(null, request.origin);
    const urlParams = new URL(request.resource, `http://${request.host}`).searchParams;
    const username = urlParams.get("username");

    if (!username) {
        connection.sendUTF(JSON.stringify({ error: "Username tidak valid" }));
        connection.close();
        return;
    }

    console.log(`🔗 Mencoba terhubung ke live @${username}...`);
    
    const tiktokConnection = new WebcastPushConnection(username);
    
    try {
        await tiktokConnection.connect();
        console.log(`✅ Terhubung ke live @${username}`);
        connection.sendUTF(JSON.stringify({ system: `Terhubung ke live @${username}` }));
    } catch (err) {
        console.error("❌ Gagal terhubung:", err);
        connection.sendUTF(JSON.stringify({ error: "Gagal terhubung ke live" }));
        connection.close();
        return;
    }

    tiktokConnection.on("chat", (data) => {
        console.log(`💬 ${data.uniqueId}: ${data.comment}`);
        connection.sendUTF(JSON.stringify({ user: data.uniqueId, text: data.comment }));
    });

    tiktokConnection.on("error", (err) => {
        console.error(`🚨 Error TikTok Live: ${err.message}`);
        connection.sendUTF(JSON.stringify({ error: `Error TikTok Live: ${err.message}` }));
    });

    // Ping-Pong untuk menjaga koneksi tetap hidup
    const pingInterval = setInterval(() => {
        if (connection.connected) {
            connection.sendUTF(JSON.stringify({ type: "ping" }));
        }
    }, 30000);

    connection.on("message", (message) => {
        if (message.utf8Data === JSON.stringify({ type: "ping" })) {
            connection.sendUTF(JSON.stringify({ type: "pong" }));
        }
    });

    connection.on("close", () => {
        clearInterval(pingInterval);
        tiktokConnection.disconnect();
        console.log(`❌ Koneksi ke @${username} ditutup`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
