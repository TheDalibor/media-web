const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

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
        cb(null, 'public/gallery/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for images and videos
const fileFilter = (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif|webp|bmp|tiff|tif/i;
    const videoTypes = /mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|3g2|quicktime/i;
    const imageMimeTypes = /^image\/(jpeg|jpg|png|gif|webp|bmp|tiff)/i;
    const videoMimeTypes = /^video\/(mp4|quicktime|x-msvideo|webm|x-flv|x-matroska|3gpp)/i;
    
    const ext = path.extname(file.originalname).toLowerCase();
    const extMatch = imageTypes.test(ext) || videoTypes.test(ext);
    const mimeMatch = imageMimeTypes.test(file.mimetype) || videoMimeTypes.test(file.mimetype);
    
    if (mimeMatch || extMatch) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 300 * 1024 * 1024, // 200MB limit
    },
    fileFilter: fileFilter
});

// Serve static files from public directory
app.use(express.static('public'));

// Gallery endpoint
app.get('/api/gallery', (req, res) => {
    try {
        const files = fs.readdirSync(galleryDir);
        const mediaFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return /\.(jpeg|jpg|png|gif|webp|bmp|tiff|tif|mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|3g2)$/i.test(ext);
        }).map(file => {
            const ext = path.extname(file).toLowerCase();
            const isVideo = /\.(mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|3g2)$/i.test(ext);
            const stats = fs.statSync(path.join(galleryDir, file));
            
            return {
                filename: file,
                path: `/gallery/${file}`,
                type: isVideo ? 'video' : 'image',
                size: stats.size,
                uploadDate: stats.birthtime || stats.ctime
            };
        });
        
        // Sort by upload date (newest first)
        mediaFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        
        res.json(mediaFiles);
    } catch (error) {
        console.error('Error reading gallery directory:', error);
        res.status(500).json({ error: 'Failed to read gallery' });
    }
});

// Upload endpoint - simple since conversion happens client-side
app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`📤 Successfully uploaded ${req.files.length} file(s):`);
    req.files.forEach(file => {
        console.log(`  ✅ ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
    });
    
    res.json({ 
        success: true, 
        message: `${req.files.length} file(s) uploaded successfully!`,
        files: req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size
        }))
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error.message);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File too large! Maximum size is 200MB per file.' 
            });
        }
        return res.status(400).json({ 
            error: `Upload error: ${error.message}` 
        });
    }
    
    if (error.message.includes('Only images and videos are allowed')) {
        return res.status(400).json({ 
            error: error.message 
        });
    }
    
    res.status(500).json({ 
        error: 'Server error occurred. Please try again.' 
    });
});

// Download all files as zip
app.get('/api/gallery/download', (req, res) => {
    try {
        const files = fs.readdirSync(galleryDir);
        const mediaFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return /\.(jpeg|jpg|png|gif|webp|bmp|tiff|tif|mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|3g2)$/i.test(ext);
        });

        if (mediaFiles.length === 0) {
            return res.status(404).json({ error: 'No media files to download.' });
        }

        res.setHeader('Content-Disposition', 'attachment; filename=wedding-gallery.zip');
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', {
            zlib: { level: 6 }
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).json({ error: 'Failed to create zip file' });
        });

        archive.pipe(res);

        mediaFiles.forEach(file => {
            const filePath = path.join(galleryDir, file);
            archive.file(filePath, { name: file });
        });

        archive.finalize();

    } catch (error) {
        console.error('Error creating zip archive:', error);
        res.status(500).json({ error: 'Failed to create zip file' });
    }
});

app.listen(PORT, () => {
    console.log('🎉 Wedding gallery server starting...');
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`📁 Gallery: ${galleryDir}`);
    console.log('📱 HEIC files converted client-side with heic2any');
    console.log('✨ Ready for uploads!');
});