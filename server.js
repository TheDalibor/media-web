const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Create gallery directory if it doesn't exist
const galleryDir = path.join(__dirname, 'public', 'gallery');
if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(galleryDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/gallery/'); // Store in public/gallery
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for only images and videos
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv|webm|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit (more reasonable than 3GB)
    },
    fileFilter: fileFilter
});

// Serve static files from public directory
app.use(express.static('public'));

// Get gallery files endpoint
app.get('/api/gallery', (req, res) => {
    try {
        const files = fs.readdirSync(galleryDir);
        const mediaFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return /\.(jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv|webm|mkv)$/i.test(ext);
        }).map(file => {
            const ext = path.extname(file).toLowerCase();
            const isVideo = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i.test(ext);
            return {
                filename: file,
                path: `/gallery/${file}`, // This will work because gallery is in public/
                type: isVideo ? 'video' : 'image'
            };
        });
        
        // Sort by filename (which includes timestamp) to show newest first
        mediaFiles.sort((a, b) => b.filename.localeCompare(a.filename));
        
        res.json(mediaFiles);
    } catch (error) {
        console.error('Error reading gallery directory:', error);
        res.status(500).json({ error: 'Failed to read gallery' });
    }
});

// Upload endpoint
app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`Uploaded ${req.files.length} file(s)`);
    res.json({ 
        success: true, 
        message: `${req.files.length} file(s) uploaded successfully`,
        files: req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size
        }))
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 100MB)' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files' });
        }
    }
    
    if (error.message === 'Only images and videos are allowed!') {
        return res.status(400).json({ error: 'Only images and videos are allowed!' });
    }
    
    res.status(500).json({ error: 'Server error occurred' });
});

app.listen(PORT, () => {
    console.log(`Wedding gallery server running on http://localhost:${PORT}`);
    console.log(`Gallery directory: ${galleryDir}`);
});