const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require('cors');

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());

let users = {};  // Store connected users

io.on('connection', socket => {
    console.log(`🟢 New user connected: ${socket.id}`);

    // Register user
    socket.on("register", (userId) => {
        if (!userId) return;

        // Remove old socket ID if user re-registers (e.g., refreshes page)
        for (let user in users) {
            if (users[user] === socket.id) {
                delete users[user];
            }
        }

        users[userId] = socket.id;
        io.emit("updateUsers", Object.keys(users));
        console.log(`✅ User ${userId} registered.`);
    });

    // Private messaging
    socket.on("private-message", ({ sender, receiver, message }) => {
        if (!sender || !receiver || !message) return;

        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive-message", { sender, message });
            console.log(`📩 Message sent from ${sender} to ${receiver}: "${message}"`);
        } else {
            console.log(`⚠️ User ${receiver} not found. Message not delivered.`);
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        let disconnectedUser = null;
        for (let user in users) {
            if (users[user] === socket.id) {
                disconnectedUser = user;
                delete users[user];
                break;
            }
        }

        if (disconnectedUser) {
            console.log(`🔴 User ${disconnectedUser} disconnected.`);
        }

        io.emit("updateUsers", Object.keys(users));
    });
});

server.listen(1010, () => console.log('🚀 Server running on http://localhost:1010'));
