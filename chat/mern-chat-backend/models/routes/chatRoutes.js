const express = require('express');
const Message = require('../models/Message');
const router = express.Router();

// ✅ Get Chat Messages Between Two Users
router.get('/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        const messages = await Message.find({
            $or: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Save a New Message
router.post('/send', async (req, res) => {
    try {
        const { senderId, receiverId, message } = req.body;
        const newMessage = new Message({ senderId, receiverId, message });

        await newMessage.save();
        res.status(201).json({ message: "Message sent successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
