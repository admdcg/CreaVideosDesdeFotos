// State variables
let photoList = []; // Array of { id, file, name, size, url, img }
let uploadedAudioFile = null;
let isRendering = false;
let renderInterval = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
let audioSourceNode = null;
let audioDestinationNode = null;

// Target dimensions
let targetW = 1280;
let targetH = 720;

// DOM Elements
const durationSlider = document.getElementById('duration-slider');
const durationVal = document.getElementById('duration-val');
const transitionSlider = document.getElementById('transition-slider');
const transitionVal = document.getElementById('transition-val');
const fitModeSelect = document.getElementById('fit-mode-select');
const resolutionSelect = document.getElementById('resolution-select');
const audioOptions = document.getElementsByName('audio-option');
const uploadAreaContainer = document.getElementById('upload-area-container');
const audioFileInput = document.getElementById('audio-file-input');
const selectedAudioName = document.getElementById('selected-audio-name');

const btnGenerate = document.getElementById('btn-generate');
const renderProgressContainer = document.getElementById('render-progress-container');
const progressStatusText = document.getElementById('progress-status-text');
const progressPercentText = document.getElementById('progress-percent-text');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressMessageDetail = document.getElementById('progress-message-detail');

const resultVideoCard = document.getElementById('result-video-card');
const resultVideoPlayer = document.getElementById('result-video-player');
const btnDownloadVideo = document.getElementById('btn-download-video');
const btnCloseResult = document.getElementById('btn-close-result');

const photoCountBadge = document.getElementById('photo-count-badge');
const photoCount = document.getElementById('photo-count');
const photosGridContainer = document.getElementById('photos-grid-container');
const photosEmptyDropzone = document.getElementById('photos-empty-dropzone');
const photoFileInput = document.getElementById('photo-file-input');

const btnSortName = document.getElementById('btn-sort-name');
const btnReverseOrder = document.getElementById('btn-reverse-order');

const renderCanvas = document.getElementById('render-canvas');
const bgAudio = document.getElementById('bg-audio');

// Default Music URL
const DEFAULT_MUSIC_URL = "default_music.mp3";

// Toast Helper
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${
        type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'
    }"></i> <span>${message}</span>`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4500);
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    setupSliders();
    setupAudioOptions();
    setupDropzone();
    setupSortingActions();
    
    // Close preview card
    btnCloseResult.addEventListener('click', () => {
        resultVideoCard.classList.add('hidden');
        resultVideoPlayer.pause();
    });

    // Start video generation
    btnGenerate.addEventListener('click', startVideoGeneration);
});

// Configure Sliders
function setupSliders() {
    durationSlider.addEventListener('input', () => {
        durationVal.textContent = `${durationSlider.value}s`;
    });
    
    transitionSlider.addEventListener('input', () => {
        transitionVal.textContent = `${transitionSlider.value}s`;
        if (parseFloat(transitionSlider.value) >= parseFloat(durationSlider.value)) {
            // Prevent transition from being longer than photo duration
            transitionSlider.value = (parseFloat(durationSlider.value) - 0.2).toFixed(1);
            transitionVal.textContent = `${transitionSlider.value}s`;
            showToast('La transición debe ser menor que la duración de la foto', 'warning');
        }
    });
}

// Audio configuration
function setupAudioOptions() {
    audioOptions.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'uploaded') {
                uploadAreaContainer.classList.remove('hidden');
            } else {
                uploadAreaContainer.classList.add('hidden');
            }
        });
    });
    
    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadedAudioFile = file;
            selectedAudioName.textContent = file.name;
            showToast('Audio seleccionado', 'success');
        }
    });
}

// Setup Drag and Drop for Photo Import
function setupDropzone() {
    const triggerInput = () => photoFileInput.click();
    photosEmptyDropzone.addEventListener('click', triggerInput);
    
    photoFileInput.addEventListener('change', (e) => {
        handlePhotoFiles(e.target.files);
    });

    // Drag events for dropzone
    ['dragenter', 'dragover'].forEach(eventName => {
        photosEmptyDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            photosEmptyDropzone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        photosEmptyDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            photosEmptyDropzone.classList.remove('drag-active');
        }, false);
    });

    photosEmptyDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handlePhotoFiles(files);
    });
}

// Process imported photo files
function handlePhotoFiles(files) {
    if (!files || files.length === 0) return;
    
    let loadedCount = 0;
    const totalToLoad = Array.from(files).filter(f => f.type.startsWith('image/')).length;
    
    if (totalToLoad === 0) {
        showToast('Por favor, arrastra solo archivos de imagen', 'error');
        return;
    }

    showToast(`Cargando ${totalToLoad} fotos...`, 'info');
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const id = 'img_' + Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        
        const img = new Image();
        img.src = url;
        img.onload = () => {
            photoList.push({
                id,
                file,
                name: file.name,
                size: file.size,
                url,
                img
            });
            
            loadedCount++;
            if (loadedCount === totalToLoad) {
                updateUIState();
                showToast(`Se cargaron ${totalToLoad} fotos correctamente`, 'success');
            }
        };
        img.onerror = () => {
            loadedCount++;
            if (loadedCount === totalToLoad) {
                updateUIState();
            }
        };
    });
}

// Update badges and grid
function updateUIState() {
    const count = photoList.length;
    photoCount.textContent = count;
    photoCountBadge.textContent = count;
    
    if (count > 0) {
        photosEmptyDropzone.classList.add('hidden');
        photosGridContainer.classList.remove('hidden');
        btnGenerate.disabled = false;
        btnSortName.disabled = false;
        btnReverseOrder.disabled = false;
        renderPhotosGrid();
    } else {
        photosEmptyDropzone.classList.remove('hidden');
        photosGridContainer.classList.add('hidden');
        btnGenerate.disabled = true;
        btnSortName.disabled = true;
        btnReverseOrder.disabled = true;
    }
}

// Render Photo Items Grid
function renderPhotosGrid() {
    photosGridContainer.innerHTML = '';
    
    photoList.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.setAttribute('draggable', 'true');
        item.setAttribute('data-id', photo.id);
        
        const sizeKB = (photo.size / 1024).toFixed(0);
        const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        
        item.innerHTML = `
            <span class="photo-index">${index + 1}</span>
            <button class="btn-delete-photo" title="Eliminar foto"><i class="fa-solid fa-trash"></i></button>
            <img src="${photo.url}" class="photo-thumbnail" alt="${photo.name}" loading="lazy">
            <div class="photo-overlay">
                <span class="photo-filename">${photo.name}</span>
                <span class="photo-size">${sizeFormatted}</span>
            </div>
        `;
        
        // Remove handler
        item.querySelector('.btn-delete-photo').addEventListener('click', (e) => {
            e.stopPropagation();
            removePhoto(photo.id);
        });
        
        addDragAndDropHandlers(item);
        photosGridContainer.appendChild(item);
    });
}

// Remove photo from list
function removePhoto(id) {
    const index = photoList.findIndex(p => p.id === id);
    if (index !== -1) {
        // Revoke URL to free memory
        URL.revokeObjectURL(photoList[index].url);
        photoList.splice(index, 1);
        updateUIState();
    }
}

// Drag and drop events for thumbnails
let draggedItem = null;

function addDragAndDropHandlers(item) {
    item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.photo-item').forEach(el => el.classList.remove('drag-over'));
        draggedItem = null;
        updatePhotoOrderFromDOM();
    });

    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== draggedItem) {
            item.classList.add('drag-over');
        }
    });

    item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        
        if (item !== draggedItem) {
            const rect = item.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            
            if (e.clientX < midpoint) {
                item.parentNode.insertBefore(draggedItem, item);
            } else {
                item.parentNode.insertBefore(draggedItem, item.nextSibling);
            }
        }
    });
}

// Synchronize photoList state array with DOM elements ordering
function updatePhotoOrderFromDOM() {
    const items = photosGridContainer.querySelectorAll('.photo-item');
    const newOrder = [];
    
    items.forEach((item, index) => {
        const id = item.getAttribute('data-id');
        const photoObj = photoList.find(p => p.id === id);
        if (photoObj) {
            newOrder.push(photoObj);
        }
        item.querySelector('.photo-index').textContent = index + 1;
    });
    
    photoList = newOrder;
}

// Sorting tools
function setupSortingActions() {
    btnSortName.addEventListener('click', () => {
        photoList.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
        renderPhotosGrid();
        showToast('Fotos ordenadas alfabéticamente', 'info');
    });
    
    btnReverseOrder.addEventListener('click', () => {
        photoList.reverse();
        renderPhotosGrid();
        showToast('Orden invertido', 'info');
    });
}

// Start rendering video slideshow in browser canvas
async function startVideoGeneration() {
    if (isRendering || photoList.length === 0) return;
    
    isRendering = true;
    btnGenerate.disabled = true;
    resultVideoCard.classList.add('hidden');
    renderProgressContainer.classList.remove('hidden');
    
    updateProgressBar(0, 'Inicializando...', 'Preparando motor de renderizado...');
    
    // Select resolution
    const resValue = resolutionSelect.value;
    const dimensions = resValue.split('x');
    targetW = parseInt(dimensions[0]);
    targetH = parseInt(dimensions[1]);
    
    renderCanvas.width = targetW;
    renderCanvas.height = targetH;
    
    // Setup Audio
    let audioOption = 'default';
    audioOptions.forEach(radio => {
        if (radio.checked) audioOption = radio.value;
    });
    
    updateProgressBar(5, 'Cargando Audio', 'Iniciando pista musical...');
    
    try {
        if (audioOption === 'uploaded') {
            if (!uploadedAudioFile) {
                throw new Error('Por favor, selecciona un archivo de audio para la opción cargada.');
            }
            bgAudio.src = URL.createObjectURL(uploadedAudioFile);
        } else {
            // Default SoundHelix track
            bgAudio.crossOrigin = "anonymous";
            bgAudio.src = DEFAULT_MUSIC_URL;
        }
        
        // Wait for audio to be ready or try loading it
        bgAudio.load();
        
        // Setup AudioContext for clean stream capture (mixing canvas video track & audio element track)
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Resume context if suspended (browser security policy)
            await audioContext.resume();
            
            // Clean node connection
            if (audioSourceNode) {
                audioSourceNode.disconnect();
            }
            audioSourceNode = audioContext.createMediaElementSource(bgAudio);
            audioDestinationNode = audioContext.createMediaStreamDestination();
            
            audioSourceNode.connect(audioDestinationNode);
            audioSourceNode.connect(audioContext.destination); // Play locally
        } catch (ctxErr) {
            console.warn("No se pudo iniciar AudioContext con captura. Grabando sin música...", ctxErr);
            showToast('Grabando video sin música. Navegadores locales a veces bloquean música remota CORS. Prueba cargando un archivo MP3 local para tener audio.', 'warning');
        }
        
        // Render parameters
        const durationPerPhoto = parseFloat(durationSlider.value);
        const transitionDuration = parseFloat(transitionSlider.value);
        const hasTransition = transitionDuration > 0;
        const fitMode = fitModeSelect.value;
        
        // Compute timing
        const n = photoList.length;
        // Total duration equation: n * durationPerPhoto - (n - 1) * transitionDuration
        const totalDuration = n > 1 ? (n * durationPerPhoto - (n - 1) * transitionDuration) : durationPerPhoto;
        
        // Setup MediaRecorder
        const canvasStream = renderCanvas.captureStream(24); // 24 FPS video track
        
        const outputStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(track => outputStream.addTrack(track));
        
        // Add captured audio track if AudioContext destination is available
        if (audioDestinationNode && audioDestinationNode.stream.getAudioTracks().length > 0) {
            audioDestinationNode.stream.getAudioTracks().forEach(track => outputStream.addTrack(track));
        }
        
        // Choose MIME Type
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
        
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(outputStream, { mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const videoUrl = URL.createObjectURL(blob);
            
            // Set results
            resultVideoPlayer.src = videoUrl;
            btnDownloadVideo.href = videoUrl;
            btnDownloadVideo.download = mimeType.includes('mp4') ? 'video_slideshow.mp4' : 'video_slideshow.webm';
            
            resultVideoCard.classList.remove('hidden');
            resultVideoCard.scrollIntoView({ behavior: 'smooth' });
            
            resetUIProgressState();
            showToast('¡Video generado correctamente!', 'success');
        };
        
        // Draw first frame before starting recorder
        drawSlideshowAtTime(0, fitMode, durationPerPhoto, transitionDuration, totalDuration);
        
        // Start playing audio and recording
        mediaRecorder.start();
        bgAudio.currentTime = 0;
        bgAudio.play().catch(e => console.warn("Auto-play blocked, recording anyway.", e));
        
        // Set running render loop
        let elapsed = 0;
        const fps = 24;
        const frameInterval = 1000 / fps;
        
        renderInterval = setInterval(() => {
            elapsed += frameInterval / 1000;
            
            if (elapsed >= totalDuration) {
                clearInterval(renderInterval);
                bgAudio.pause();
                mediaRecorder.stop();
                return;
            }
            
            drawSlideshowAtTime(elapsed, fitMode, durationPerPhoto, transitionDuration, totalDuration);
            
            const percent = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
            updateProgressBar(percent, 'Codificando Video', `Procesando fotograma: ${elapsed.toFixed(1)}s de ${totalDuration.toFixed(1)}s...`);
        }, frameInterval);
        
    } catch (err) {
        console.error(err);
        showToast(`Fallo en el renderizado: ${err.message}`, 'error');
        resetUIProgressState();
    }
}

// Draw the specific frame of slideshow at timestamp 't' (seconds)
function drawSlideshowAtTime(t, fitMode, duration, transition, totalDuration) {
    const ctx = renderCanvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetW, targetH);
    
    const n = photoList.length;
    
    // Find active photo indexes
    // Each photo index 'i' starts at: i * (duration - transition)
    // and ends at: start + duration
    let activeClips = [];
    
    for (let i = 0; i < n; i++) {
        const startTime = i * (duration - transition);
        const endTime = startTime + duration;
        
        if (t >= startTime && t <= endTime) {
            activeClips.push({
                index: i,
                startTime,
                endTime
            });
        }
    }
    
    if (activeClips.length === 0) return;
    
    // Case 1: Only 1 active photo clip (no transition zone)
    if (activeClips.length === 1) {
        const clip = activeClips[0];
        const photo = photoList[clip.index];
        ctx.globalAlpha = 1.0;
        drawSinglePhoto(ctx, photo.img, fitMode);
    } 
    // Case 2: Transition zone (2 photos overlapping)
    else if (activeClips.length > 1) {
        // Sort by index to draw outgoing first, incoming on top
        activeClips.sort((a, b) => a.index - b.index);
        
        const outgoingClip = activeClips[0];
        const incomingClip = activeClips[1];
        
        const outgoingPhoto = photoList[outgoingClip.index];
        const incomingPhoto = photoList[incomingClip.index];
        
        // Draw outgoing photo (fully opaque)
        ctx.globalAlpha = 1.0;
        drawSinglePhoto(ctx, outgoingPhoto.img, fitMode);
        
        // Determine transition alpha progress
        // Transition starts when incoming photo starts, ends when outgoing photo ends
        const transStart = incomingClip.startTime;
        const transEnd = outgoingClip.endTime;
        const transDur = transEnd - transStart;
        
        let alpha = 0;
        if (transDur > 0) {
            alpha = (t - transStart) / transDur;
            alpha = Math.max(0, Math.min(1, alpha)); // Clamp
        }
        
        // Draw incoming photo (fading in)
        ctx.globalAlpha = alpha;
        drawSinglePhoto(ctx, incomingPhoto.img, fitMode);
    }
    
    ctx.globalAlpha = 1.0; // Reset
}

// Draw a single image on canvas with scaling/effects
function drawSinglePhoto(ctx, img, fitMode) {
    const origW = img.width;
    const origH = img.height;
    
    const targetRatio = targetW / targetH;
    const origRatio = origW / origH;
    
    if (fitMode === 'cropped') {
        // Scale to fill
        let drawW, drawH, sx, sy, sWidth, sHeight;
        
        if (origRatio > targetRatio) {
            // Image is wider than target
            sHeight = origH;
            sWidth = origH * targetRatio;
            sx = (origW - sWidth) / 2;
            sy = 0;
        } else {
            // Image is taller than target
            sWidth = origW;
            sHeight = origW / targetRatio;
            sx = 0;
            sy = (origH - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
    } 
    else if (fitMode === 'black_bars') {
        // Scale to fit centered
        let fitW, fitH;
        if (origRatio > targetRatio) {
            fitW = targetW;
            fitH = targetW / origRatio;
        } else {
            fitH = targetH;
            fitW = targetH * origRatio;
        }
        const dx = (targetW - fitW) / 2;
        const dy = (targetH - fitH) / 2;
        ctx.drawImage(img, dx, dy, fitW, fitH);
    } 
    else { // blurred_background
        // 1. Draw blurred background covering entire canvas
        // Scale background cover
        let bgW, bgH, bgX, bgY;
        if (origRatio > targetRatio) {
            bgW = targetH * origRatio;
            bgH = targetH;
            bgX = (targetW - bgW) / 2;
            bgY = 0;
        } else {
            bgW = targetW;
            bgH = targetW / origRatio;
            bgX = 0;
            bgY = (targetH - bgH) / 2;
        }
        
        ctx.save();
        ctx.filter = 'blur(25px)';
        // Draw the image larger and blur it
        ctx.drawImage(img, bgX - 20, bgY - 20, bgW + 40, bgH + 40);
        ctx.restore();
        
        // 2. Draw sharp image fitting inside canvas centered on top
        let fitW, fitH;
        if (origRatio > targetRatio) {
            fitW = targetW;
            fitH = targetW / origRatio;
        } else {
            fitH = targetH;
            fitW = targetH * origRatio;
        }
        const dx = (targetW - fitW) / 2;
        const dy = (targetH - fitH) / 2;
        ctx.drawImage(img, dx, dy, fitW, fitH);
    }
}

// Update UI Progress Bar Info
function updateProgressBar(percent, statusText, detailText) {
    progressBarFill.style.width = `${percent}%`;
    progressPercentText.textContent = `${percent}%`;
    progressStatusText.textContent = statusText;
    progressMessageDetail.textContent = detailText;
}

// Reset UI Progress state
function resetUIProgressState() {
    isRendering = false;
    btnGenerate.disabled = false;
    renderProgressContainer.classList.add('hidden');
    if (renderInterval) {
        clearInterval(renderInterval);
        renderInterval = null;
    }
}
