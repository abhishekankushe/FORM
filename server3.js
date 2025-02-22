require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI is missing in environment variables.");
    process.exit(1);
}

// Middleware
app.use(cors({ origin: "http://yourfrontend.com", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ **Fixed MongoDB Connection**
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    });

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
    limits: { fileSize: 1024 * 1024 * 5 }
});

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    experience: { type: Number, required: true, min: 0 },
    skills: { type: [String], default: [] },
    imageUrl: { type: String, default: '' }
});
userSchema.index({ name: "text", skills: "text" });
const User = mongoose.model('User', userSchema);

// Search Users API (Optimized using $text search)
app.get('/api/users/search', async (req, res) => {
    try {
        const query = req.query.name?.trim();
        if (!query) return res.status(400).json({ error: "Name parameter is required" });

        const users = await User.find({ $text: { $search: query } });
        res.status(200).json(users);
    } catch (err) {
        console.error("Error searching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Fetch All Users API
app.get('/api/users', async (req, res) => {
    try {
        let query = {};
        if (req.query.userId) {
            query = { _id: { $ne: req.query.userId } };
        }
        const users = await User.find(query);
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Rating Schema
const RatingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }
});
const Rating = mongoose.model("Rating", RatingSchema);

// Rate a User
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

// Get Average Rating of a User (Optimized with Aggregation)
app.get("/rating/:userId", async (req, res) => {
    try {
        const result = await Rating.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } },
            { $group: { _id: "$userId", avgRating: { $avg: "$rating" }, total: { $sum: 1 } } }
        ]);
        res.json(result.length ? result[0] : { averageRating: 0, totalRatings: 0 });
    } catch (err) {
        res.status(500).json({ message: "Error fetching rating" });
    }
});

// Add User API (Validation with Joi)
app.post('/api/users', upload.single('image'), async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().required(),
            experience: Joi.number().min(0).required(),
            skills: Joi.array().items(Joi.string()).default([])
        });
        const { error, value } = schema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { name, experience, skills } = value;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
        const existingUser = await User.findOne({ name: new RegExp(`^${name}$`, "i") });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const newUser = new User({ name, experience, skills, imageUrl });
        await newUser.save();
        res.status(201).json({ message: "User added successfully!", user: newUser });
    } catch (err) {
        console.error("Error saving user:", err);
        res.status(500).json({ error: "Failed to save user" });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
