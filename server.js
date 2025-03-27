const express = require("express");
const http = require("http");
const WebSocket = require("websocket").server;
const axios = require("axios");  // Import Axios
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocket({ httpServer: server });

app.use(express.static("."));

const leaderboard = {};  // Menyimpan top gift & chatters
const bannedWords = ["botlu", "kont"]; // Daftar kata kasar

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

    // 🔥 Event Chat (Filter Kata Kasar & Leaderboard)
    tiktokConnection.on("chat", (data) => {
        let comment = data.comment;
        bannedWords.forEach(word => {
            let regex = new RegExp(word, "gi");
            comment = comment.replace(regex, "***");
        });

        console.log(`💬 ${data.uniqueId}: ${comment}`);
        connection.sendUTF(JSON.stringify({ user: data.uniqueId, text: comment }));

        // Update leaderboard chatters
        leaderboard[data.uniqueId] = (leaderboard[data.uniqueId] || 0) + 1;
        connection.sendUTF(JSON.stringify({ leaderboard }));
    });

    // 🎁 Event Gift (Efek Visual & Leaderboard)
    tiktokConnection.on("gift", (data) => {
        console.log(`🎁 ${data.uniqueId} mengirim gift ${data.giftId}`);

        // 🔔 Notifikasi Sound untuk Gift Spesifik
        if (data.giftId === "1234") {
            connection.sendUTF(JSON.stringify({ sound: "gift.mp3" }));
        }

        // 🔥 Efek Visual untuk Gift Besar
        if (data.diamondCount > 1000) {
            connection.sendUTF(JSON.stringify({ effect: "fire.gif" }));
        }

        // Update leaderboard gift
        leaderboard[data.uniqueId] = (leaderboard[data.uniqueId] || 0) + data.diamondCount;
        connection.sendUTF(JSON.stringify({ leaderboard }));
    });

    // 👥 Event User Join
    tiktokConnection.on("member", (data) => {
        console.log(`👥 ${data.uniqueId} bergabung`);
        connection.sendUTF(JSON.stringify({ join: data.uniqueId }));
    });

    // 📣 Event Share
    tiktokConnection.on("social", (data) => {
        if (data.displayType === "share") {
            console.log(`📣 ${data.uniqueId} membagikan live`);
            connection.sendUTF(JSON.stringify({ share: data.uniqueId }));
        }
    });

    connection.on("close", () => {
        tiktokConnection.disconnect();
        console.log(`❌ Koneksi ke @${username} ditutup`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
