const express = require("express");
const http = require("http");
const WebSocketServer = require("websocket").server;
const axios = require("axios");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer: server });

app.use(express.static("."));

wsServer.on("request", (request) => {
    const connection = request.accept(null, request.origin);
    const urlParams = new URL(request.resourceURL.href, `http://${request.host}`).searchParams;
    const username = urlParams.get("username");

    if (!username) {
        connection.sendUTF(JSON.stringify({ error: "Username tidak valid" }));
        connection.close();
        return;
    }

    const tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect().then(() => {
        console.log(`✅ Terhubung ke live @${username}`);
    }).catch(err => {
        console.error("❌ Gagal terhubung:", err);
        connection.sendUTF(JSON.stringify({ error: "Gagal terhubung ke live" }));
        connection.close();
    });

    // Event chat dengan filter kata kasar
    const bannedWords = ["kasar1", "kasar2"];  // Tambahkan kata kasar di sini
    tiktokConnection.on("chat", (data) => {
        let comment = data.comment;
        bannedWords.forEach(word => {
            const regex = new RegExp(word, "gi");
            comment = comment.replace(regex, "***");
        });

        console.log(`💬 ${data.uniqueId}: ${comment}`);
        broadcast({ type: "chat", user: data.uniqueId, text: comment });
    });

    // Event user join
    tiktokConnection.on("viewer", (data) => {
        console.log(`👤 ${data.uniqueId} bergabung ke live`);
        broadcast({ type: "join", user: data.uniqueId });
    });

    // Event user share
    tiktokConnection.on("social", (data) => {
        if (data.displayType === "share") {
            console.log(`🔄 ${data.uniqueId} membagikan live`);
            broadcast({ type: "share", user: data.uniqueId });
        }
    });

    // Kirim ping setiap 30 detik untuk menjaga koneksi
    const pingInterval = setInterval(() => {
        if (connection.connected) {
            connection.sendUTF(JSON.stringify({ type: "ping" }));
        } else {
            clearInterval(pingInterval);
        }
    }, 30000);

    connection.on("close", () => {
        clearInterval(pingInterval);
        tiktokConnection.disconnect();
        console.log(`❌ Koneksi ke @${username} ditutup`);
    });

    function broadcast(data) {
        wsServer.connections.forEach(client => {
            if (client.connected) {
                client.sendUTF(JSON.stringify(data));
            }
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
