require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/SkillDB";

app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected to SkillDB'))
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1); // Exit the server on connection failure
    });

// ✅ Define Category Schema & Model
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    skills: { type: [String], required: true }
}, { collection: "categories" });

const Category = mongoose.model('Category', categorySchema);

// ✅ Define User Schema & Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true }, // Indexed for fast queries
    skills: { type: [String], required: true }
}, { collection: "users" });

const User = mongoose.model('User', userSchema);

// ✅ API: Fetch Skills by Category
app.get('/api/skills/:category', async (req, res) => {
    try {
        const category = req.params.category;
        console.log(`🔍 Fetching skills for category: ${category}`);

        const data = await Category.findOne({ name: new RegExp(`^${category}$`, "i") });

        if (!data) {
            console.warn(`⚠️ Category '${category}' not found`);
            return res.status(404).json({ error: `Category '${category}' not found` });
        }

        res.json({ category: data.name, skills: data.skills });
    } catch (error) {
        console.error("🔥 Error fetching skills:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// ✅ API: Fetch Users by Category
app.get('/api/users/:category', async (req, res) => {
    try {
        const categoryName = req.params.category;
        console.log(`🔍 Fetching users for category: ${categoryName}`);

        const users = await User.find({ category: new RegExp(`^${categoryName}$`, "i") });

        if (users.length === 0) {
            console.warn(`⚠️ No users found in category '${categoryName}'`);
            return res.status(404).json({ error: `No users found in '${categoryName}' category` });
        }

        res.json(users);
    } catch (error) {
        console.error("🔥 Error fetching users:", error.message);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
