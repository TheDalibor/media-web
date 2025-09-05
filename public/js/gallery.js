document.addEventListener('DOMContentLoaded', function() {
    const galleryGrid = document.getElementById('galleryGrid');
    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxContent = document.getElementById('lightboxContent');
    const lightboxVideo = document.getElementById('lightboxVideo');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadingSpinner = document.getElementById('loadingSpinner'); // Spinner element
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

let currentIndex = -1; // track current opened media index


    let allMediaFiles = [];
    let displayedCount = 0;
    const itemsPerLoad = 80;
    let isLoading = false;

    async function loadGallery() {
        if (isLoading) return;
        isLoading = true;
        loadingSpinner.style.display = 'flex'; // Show spinner

        try {
            const response = await fetch('/api/gallery');
            allMediaFiles = await response.json();

            if (displayedCount === 0) {
                galleryGrid.innerHTML = '';
            }

            if (allMediaFiles.length === 0) {
                galleryGrid.innerHTML = `
                    <div class="placeholder-container">
                        <div class="placeholder-image">
                            <span class="placeholder-text">No photos uploaded yet.<br>Be the first to share your beautiful memories!</span>
                        </div>
                    </div>
                `;
                return;
            }

            loadMorePhotos();

        } catch (error) {
            console.error('Error loading gallery:', error);
            galleryGrid.innerHTML = `
                <div class="placeholder-container">
                    <div class="placeholder-image">
                        <span class="placeholder-text">Unable to load gallery.<br>Please refresh the page or try again later.</span>
                    </div>
                </div>
            `;
        } finally {
            loadingSpinner.style.display = 'none'; // Hide spinner
            isLoading = false;
        }
    }

    // Reorder batch for column-count CSS to display left-to-right row by row
    function reorderForColumns(batch, columnCount = 2) {
        const rows = Math.ceil(batch.length / columnCount);
        const reordered = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columnCount; col++) {
                const index = col * rows + row;
                if (index < batch.length) {
                    reordered.push(batch[index]);
                }
            }
        }

        return reordered;
    }

    function loadMorePhotos() {
        const nextBatch = allMediaFiles.slice(displayedCount, displayedCount + itemsPerLoad);
        if (nextBatch.length === 0) return;

        nextBatch.forEach((file, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';

            galleryItem.style.setProperty('--delay', `${index * 0.1}s`);

            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'media-container';

            if (file.type === 'image') {
                const img = document.createElement('img');
                img.src = file.path;
                img.className = 'media-item';
                img.alt = 'Wedding memory';
                img.loading = 'lazy';
                img.tabIndex = 0;

                img.addEventListener('click', () => openLightbox(file.path, 'image'));
                img.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLightbox(file.path, 'image');
                    }
                });

                mediaContainer.appendChild(img);
            } else if (file.type === 'video') {
                const video = document.createElement('video');
                video.src = file.path;
                video.className = 'media-item';
                video.muted = true;
                video.preload = 'metadata';
                video.tabIndex = 0;

                const overlay = document.createElement('div');
                overlay.className = 'video-overlay';

                video.addEventListener('click', () => openLightbox(file.path, 'video'));
                video.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLightbox(file.path, 'video');
                    }
                });

                mediaContainer.appendChild(video);
                mediaContainer.appendChild(overlay);
            }

            galleryItem.appendChild(mediaContainer);
            galleryGrid.appendChild(galleryItem);
        });

        displayedCount += nextBatch.length;
        updateLoadMoreButton();
    }

    function updateLoadMoreButton() {
        if (allMediaFiles.length <= itemsPerLoad) {
            loadMoreContainer.style.display = 'none';
            return;
        }

        loadMoreContainer.style.display = 'block';

        if (displayedCount >= allMediaFiles.length) {
            loadMoreBtn.style.display = 'none';
            loadMoreContainer.innerHTML = `
                <div class="end-message">
                    ✨ You've seen all the beautiful memories! ✨
                </div>
            `;
        } else {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.textContent = `Load More`;
        }
    }

    loadMoreBtn.addEventListener('click', function() {
        if (isLoading) return;

        isLoading = true;
        loadMoreBtn.classList.add('loading');
        loadMoreBtn.disabled = true;

        setTimeout(() => {
            loadMorePhotos();
            loadMoreBtn.classList.remove('loading');
            loadMoreBtn.disabled = false;
            isLoading = false;
        }, 500);
    });

    function openLightbox(src, type) {
        if (type === 'image') {
            lightboxContent.src = src;
            lightboxContent.style.display = 'block';
            lightboxVideo.style.display = 'none';
        } else {
            lightboxVideo.src = src;
            lightboxVideo.style.display = 'block';
            lightboxContent.style.display = 'none';
        }
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        lightboxClose.focus();
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        lightboxVideo.pause();
        lightboxVideo.currentTime = 0;
        document.body.style.overflow = 'auto';
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });

    loadGallery();
});
