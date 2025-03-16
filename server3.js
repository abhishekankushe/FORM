require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const http = require('http'); // For Socket.io
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app); // Create HTTP Server
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

console.log(process.env.MONGO_URI);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only JPEG, PNG, and JPG files are allowed"), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 5 },
});

// Define User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    experience: { type: Number, required: true, min: 0 },
    skills: { type: [String], default: [] },
    imageUrl: { type: String, default: '' }
});
userSchema.index({ name: "text", skills: "text" });
const User = mongoose.model('User', userSchema);

// Chat Schema
const chatSchema = new mongoose.Schema({
    chatId: String,
    sender: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

// Real-Time Chat with Socket.io
io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    // Join a chat room
    socket.on('joinChat', (chatId) => {
        socket.join(chatId);
        console.log(`User joined chat: ${chatId}`);
    });

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
        const newMessage = new Chat(data);
        await newMessage.save();
        io.to(data.chatId).emit('receiveMessage', newMessage);
    });

    socket.on('disconnect', () => {
        console.log('🔴 User Disconnected');
    });
});

// API to Fetch Chat Messages
app.get('/chats/:chatId', async (req, res) => {
    try {
        const messages = await Chat.find({ chatId: req.params.chatId }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// API to Search Users by Name or Skills
app.get('/api/users/search', async (req, res) => {
    try {
        const query = req.query.query?.trim();
        if (!query) return res.status(400).json({ error: "Query parameter is required" });

        const users = await User.find({
            $or: [
                { name: { $regex: query, $options: "i" } },
                { skills: { $elemMatch: { $regex: query, $options: "i" } } }
            ]
        });

        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// API to Fetch All Users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// API to Add User (Handles File Uploads)
app.post('/api/users', upload.single('image'), async (req, res) => {
    try {
        const { name, experience, skills } = req.body;
        if (!name || !experience) {
            return res.status(400).json({ error: "Name and experience are required" });
        }

        const parsedSkills = JSON.parse(skills || '[]');
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

        const existingUser = await User.findOne({ name: new RegExp(`^${name}$`, "i") });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        const newUser = new User({ name, experience, skills: parsedSkills, imageUrl });
        await newUser.save();

        res.status(201).json({ message: "User added successfully!", user: newUser });
    } catch (err) {
        res.status(500).json({ error: "Failed to save user" });
    }
});

// Start Server
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
