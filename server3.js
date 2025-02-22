require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
console.log(process.env.MONGO_URI)
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const MONGO_URI = (process.env.MONGO_URI || 'mongodb://localhost:27017')
// + "/SkillsDB";
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
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

// Define Mongoose Schema & Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    experience: { type: Number, required: true, min: 0 }, // Changed from age to experience
    skills: { type: [String], default: [] },
    imageUrl: { type: String, default: '' }
});
userSchema.index({ name: "text", skills: "text" }); // Index for faster search
const User = mongoose.model('User', userSchema);

// API Endpoint to Search Users by Name or Skills
app.get('/api/users/search', async (req, res) => {
    try {
        const query = req.query.query?.trim();
        if (!query) {
            return res.status(400).json({ error: "Query parameter is required" });
        }

        // Search by name OR skills
        const users = await User.find({
            $or: [
                { name: { $regex: query, $options: "i" } },
                { skills: { $elemMatch: { $regex: query, $options: "i" } } }
            ]
        });

        res.status(200).json(users);
    } catch (err) {
        console.error("Error searching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// API Endpoint to Fetch All Users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// User Rating Schema
const RatingSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    ratedBy: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
});

const Rating = mongoose.model("Rating", RatingSchema);

// Rate a user (Prevents Duplicate Ratings & Allows Updates)
app.post("/rate", async (req, res) => {
    const { userId, ratedBy, rating } = req.body;

    if (!userId || !ratedBy || !rating) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const existingRating = await Rating.findOne({ userId, ratedBy });
        if (existingRating) {
            existingRating.rating = rating;
            await existingRating.save();
        } else {
            await Rating.create({ userId, ratedBy, rating });
        }
        res.json({ message: "Rating submitted successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Error submitting rating" });
    }
});

// Get average rating of a user
app.get("/rating/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const ratings = await Rating.find({ userId });

        if (ratings.length === 0) {
            return res.json({ userId, averageRating: 0, totalRatings: 0 });
        }

        const avgRating =
            ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        res.json({ userId, averageRating: avgRating.toFixed(1), totalRatings: ratings.length });
    } catch (err) {
        res.status(500).json({ message: "Error fetching rating" });
    }
});

// API Endpoint to Add User (Handles File Uploads)
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
        console.error("Error saving user:", err);
        res.status(500).json({ error: "Failed to save user" });
    }
});

// Start Server
app.listen(5000, () => console.log(`🚀 Server running on port ${5000}`));
