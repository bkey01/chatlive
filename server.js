const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("."));

wss.on("connection", (ws, req) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const username = urlParams.get("username");

    if (!username) {
        ws.send(JSON.stringify({ error: "Username tidak valid" }));
        ws.close();
        return;
    }

    const tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect().then(() => {
        console.log(`✅ Terhubung ke live @${username}`);
        ws.send(JSON.stringify({ status: "connected" }));
    }).catch(err => {
        console.error("❌ Gagal terhubung:", err);
        ws.send(JSON.stringify({ error: "Gagal terhubung ke live. Pastikan username benar dan sedang live!" }));
        ws.close();
    });

    tiktokConnection.on("chat", (data) => {
        if (data.uniqueId && data.comment) {
            ws.send(JSON.stringify({ user: data.uniqueId, text: data.comment }));
        } else {
            console.log("⚠️ Data chat kosong atau tidak lengkap:", data);
        }
    });

    ws.on("close", () => {
        tiktokConnection.disconnect();
        console.log(`❌ Koneksi ke @${username} ditutup`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
