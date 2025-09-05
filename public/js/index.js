const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        processAndUploadFiles(files);
    }
    e.target.value = '';
});

async function processAndUploadFiles(files) {
    const overlay = document.getElementById('upload-overlay');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressIcon = document.getElementById('progress-icon');
    const progressMessage = document.getElementById('progress-message');
    
    const circumference = 2 * Math.PI * 45;
    
    overlay.classList.add('active');
    progressBar.style.strokeDashoffset = circumference;
    progressText.textContent = '0%';
    progressText.style.display = 'block';
    progressIcon.style.display = 'none';
    progressMessage.textContent = 'Processing files...';

    try {
        // Process files (convert HEIC if needed)
        const processedFiles = await processFiles(files, (progress, message) => {
            const offset = circumference - (progress / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
            progressText.textContent = Math.round(progress) + '%';
            progressMessage.textContent = message;
        });

        // Upload processed files
        await uploadFiles(processedFiles, (progress) => {
            const offset = circumference - (progress / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
            progressText.textContent = Math.round(progress) + '%';
            progressMessage.textContent = 'Uploading files...';
        });

        // Success
        progressBar.classList.add('success');
        progressText.style.display = 'none';
        progressIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
        progressIcon.style.display = 'block';
        progressIcon.style.color = '#28a745';
        progressMessage.textContent = 'Upload successful!';
        
        setTimeout(() => {
            overlay.classList.remove('active');
            resetProgress();
            window.location.href = 'gallery.html';
        }, 2000);

    } catch (error) {
        // Error handling
        progressBar.classList.add('error');
        progressText.style.display = 'none';
        progressIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        progressIcon.style.display = 'block';
        progressIcon.style.color = '#dc3545';
        progressMessage.textContent = error.message || 'Upload failed!';

        setTimeout(() => {
            overlay.classList.remove('active');
            resetProgress();
        }, 3000);
    }
}

async function processFiles(files, progressCallback) {
    const processedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = (i / files.length) * 50; // First 50% for processing
        
        progressCallback(progress, `Processing ${file.name}...`);
        
        try {
            const processedFile = await processFile(file);
            processedFiles.push(processedFile);
        } catch (error) {
            console.error('Error processing file:', file.name, error);
            // Add original file as fallback
            processedFiles.push(file);
        }
    }
    
    progressCallback(50, 'Files processed, starting upload...');
    return processedFiles;
}

async function processFile(file) {
    // Check if it's a HEIC file
    const isHeic = file.type === 'image/heic' || 
                  file.type === 'image/heif' ||
                  file.name.toLowerCase().endsWith('.heic') ||
                  file.name.toLowerCase().endsWith('.heif');
    
    if (isHeic) {
        try {
            console.log('Converting HEIC file:', file.name);
            
            // Convert HEIC to JPEG
            const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.92
            });
            
            // Create new File object with .jpg extension
            const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            const convertedFile = new File([convertedBlob], newFileName, {
                type: 'image/jpeg',
                lastModified: file.lastModified
            });
            
            console.log(`✅ Converted ${file.name} to ${newFileName}`);
            return convertedFile;
            
        } catch (error) {
            console.error('HEIC conversion failed for', file.name, error);
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
    
    return file;
}

// Optimized upload function with chunking for large files
function uploadFilesInBatches(files, progressCallback) {
    return new Promise((resolve, reject) => {
        // Separate large videos from smaller files
        const largeFiles = files.filter(f => f.size > 50 * 1024 * 1024); // Files > 50MB
        const smallFiles = files.filter(f => f.size <= 50 * 1024 * 1024); // Files <= 50MB
        
        let uploadPromises = [];
        
        // Upload small files in batches
        if (smallFiles.length > 0) {
            const batchSize = 5; // Upload 5 small files at once
            for (let i = 0; i < smallFiles.length; i += batchSize) {
                const batch = smallFiles.slice(i, i + batchSize);
                uploadPromises.push(uploadBatch(batch, progressCallback, files.length));
            }
        }
        
        // Upload large files one by one
        largeFiles.forEach(file => {
            uploadPromises.push(uploadSingleFile(file, progressCallback, files.length));
        });
        
        Promise.all(uploadPromises)
            .then(() => resolve())
            .catch(error => reject(error));
    });
}

function uploadBatch(files, progressCallback, totalFiles) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                progressCallback(progress * (files.length / totalFiles));
            }
        });

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    resolve();
                } else {
                    let errorMessage = 'Upload failed!';
                    try {
                        const error = JSON.parse(xhr.responseText);
                        errorMessage = error.error || 'Upload failed!';
                    } catch {}
                    reject(new Error(errorMessage));
                }
            }
        };

        // Longer timeout for large uploads
        xhr.timeout = 10 * 60 * 1000; // 10 minutes
        xhr.open('POST', '/upload');
        xhr.send(formData);
    });
}

function uploadSingleFile(file, progressCallback, totalFiles) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('files', file);

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                progressCallback(progress / totalFiles);
            }
        });

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    resolve();
                } else {
                    let errorMessage = `Failed to upload ${file.name}`;
                    try {
                        const error = JSON.parse(xhr.responseText);
                        errorMessage = error.error || errorMessage;
                    } catch {}
                    reject(new Error(errorMessage));
                }
            }
        };

        // Extended timeout for large video files
        xhr.timeout = 15 * 60 * 1000; // 15 minutes for single large files
        xhr.open('POST', '/upload');
        xhr.send(formData);
    });
}

function resetProgress() {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressIcon = document.getElementById('progress-icon');

    progressBar.classList.remove('success', 'error');
    progressBar.style.strokeDashoffset = 283;
    progressText.textContent = '0%';
    progressText.style.display = 'block';
    progressIcon.style.display = 'none';
}
// Add these functions to your client-side code

// Video compression function
async function compressVideo(file) {
    return new Promise((resolve, reject) => {
        // Skip compression for small videos
        if (file.size < 50 * 1024 * 1024) { // Less than 50MB
            resolve(file);
            return;
        }
        
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadedmetadata = () => {
            // Reduce resolution for large videos
            const maxWidth = 1920;
            const maxHeight = 1080;
            const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight, 1);
            
            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;
            
            // Create MediaRecorder for compression
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000 // 2.5Mbps
            });
            
            const chunks = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const newName = file.name.replace(/\.[^.]+$/, '.webm');
                const compressedFile = new File([blob], newName, {
                    type: 'video/webm',
                    lastModified: file.lastModified
                });
                resolve(compressedFile);
            };
            
            // Draw video frames to canvas and record
            let currentTime = 0;
            const duration = video.duration;
            
            const drawFrame = () => {
                if (currentTime < duration) {
                    video.currentTime = currentTime;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    currentTime += 1/30; // 30fps
                    requestAnimationFrame(drawFrame);
                } else {
                    recorder.stop();
                }
            };
            
            recorder.start();
            drawFrame();
        };
        
        video.onerror = () => {
            resolve(file); // Return original if compression fails
        };
        
        video.src = URL.createObjectURL(file);
    });
}

// Chunked upload function
async function uploadVideoInChunks(file, onProgress) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Initialize upload
    const initResponse = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: file.name,
            filesize: file.size,
            totalChunks
        })
    });
    
    if (!initResponse.ok) {
        throw new Error('Failed to initialize upload');
    }
    
    const { uploadId } = await initResponse.json();
    
    // Upload chunks sequentially to avoid overwhelming server
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        
        const response = await fetch(`/api/upload/chunk/${uploadId}/${chunkIndex}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Chunk ${chunkIndex} upload failed`);
        }
        
        if (onProgress) {
            onProgress((chunkIndex + 1) / totalChunks * 100);
        }
    }
    
    // Complete upload
    const completeResponse = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uploadId,
            filename: file.name,
            totalChunks
        })
    });
    
    if (!completeResponse.ok) {
        throw new Error('Failed to complete upload');
    }
    
    return completeResponse.json();
}

// Update the processFile function to include video compression
async function processFile(file) {
    // Check if it's a HEIC file
    const isHeic = file.type === 'image/heic' || 
                  file.type === 'image/heif' ||
                  file.name.toLowerCase().endsWith('.heic') ||
                  file.name.toLowerCase().endsWith('.heif');
    
    if (isHeic) {
        try {
            console.log('Converting HEIC file:', file.name);
            
            // Convert HEIC to JPEG
            const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.92
            });
            
            // Create new File object with .jpg extension
            const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            const convertedFile = new File([convertedBlob], newFileName, {
                type: 'image/jpeg',
                lastModified: file.lastModified
            });
            
            console.log(`✅ Converted ${file.name} to ${newFileName}`);
            return convertedFile;
            
        } catch (error) {
            console.error('HEIC conversion failed for', file.name, error);
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
    
    // Check if it's a video file that needs compression
    const isVideo = file.type.startsWith('video/') || 
                   /\.(mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp|3g2)$/i.test(file.name);
    
    if (isVideo) {
        try {
            console.log('Compressing video file:', file.name);
            const compressedFile = await compressVideo(file);
            console.log(`✅ Processed video ${file.name}`);
            return compressedFile;
        } catch (error) {
            console.error('Video compression failed for', file.name, error);
            return file; // Return original if compression fails
        }
    }
    
    return file;
}

// Update uploadFiles function to handle chunked uploads
async function uploadFiles(files, progressCallback) {
    let totalUploaded = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Use chunked upload for large files (>20MB)
        if (file.size > 20 * 1024 * 1024) {
            await uploadVideoInChunks(file, (chunkProgress) => {
                const fileProgress = (totalUploaded + (chunkProgress / 100)) / files.length * 100;
                progressCallback(50 + fileProgress / 2); // Second 50% for uploading
            });
        } else {
            // Use regular upload for smaller files
            await uploadSingleFile(file, (fileProgress) => {
                const totalProgress = (totalUploaded + (fileProgress / 100)) / files.length * 100;
                progressCallback(50 + totalProgress / 2); // Second 50% for uploading
            }, 1);
        }
        
        totalUploaded++;
    }
}