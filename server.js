const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("."));

wss.on("connection", async (ws, req) => {
    try {
        const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const username = urlParams.get("username");

        if (!username) {
            ws.send(JSON.stringify({ error: "Username tidak valid" }));
            ws.close();
            return;
        }

        console.log(`Mencoba terhubung ke live @${username}...`);
        const tiktokConnection = new WebcastPushConnection(username);

        tiktokConnection.connect().then(() => {
            console.log(`Terhubung ke live @${username}`);
            ws.send(JSON.stringify({ message: `Terhubung ke live @${username}` }));
        }).catch(err => {
            console.error("Gagal terhubung:", err);
            ws.send(JSON.stringify({ error: "Gagal terhubung ke live. Mungkin user tidak live atau username salah." }));
            ws.close();
        });

        tiktokConnection.on("chat", (data) => {
            ws.send(JSON.stringify({ user: data.uniqueId, text: data.comment }));
        });

        ws.on("close", () => {
            tiktokConnection.disconnect();
            console.log(`Koneksi ke @${username} ditutup`);
        });

    } catch (error) {
        console.error("Terjadi kesalahan:", error);
        ws.send(JSON.stringify({ error: "Terjadi kesalahan pada server" }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
