const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
    e.target.value = '';
});

function uploadFiles(files) {
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

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
    progressMessage.textContent = 'Uploading files...';

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            const offset = circumference - (percentComplete / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
            progressText.textContent = percentComplete + '%';
        }
    });

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
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
            } else {
                progressBar.classList.add('error');
                progressText.style.display = 'none';
                progressIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                progressIcon.style.display = 'block';
                progressIcon.style.color = '#dc3545';

                let errorMessage = 'Upload failed!';
                try {
                    const error = JSON.parse(xhr.responseText);
                    errorMessage = error.error || 'Upload failed!';
                } catch {}

                progressMessage.textContent = errorMessage;

                setTimeout(() => {
                    overlay.classList.remove('active');
                    resetProgress();
                }, 3000);
            }
        }
    };

    xhr.open('POST', '/upload');
    xhr.send(formData);
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
