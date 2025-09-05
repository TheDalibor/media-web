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
                quality: 0.75
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

function uploadFiles(files, progressCallback) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                // Map upload progress to 50-100% (second half)
                const uploadProgress = (e.loaded / e.total) * 50;
                const totalProgress = 50 + uploadProgress;
                progressCallback(totalProgress);
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