class CameraApp {
constructor() {
this.video = document.getElementById('camera-feed');
this.canvas = document.getElementById('photo-canvas');
this.captureBtn = document.getElementById('capture-photo');
this.recordBtn = document.getElementById('toggle-recording');
this.toggleCameraBtn = document.getElementById('toggle-camera');
this.clearAllBtn = document.getElementById('clear-all');
this.downloadAllBtn = document.getElementById('download-all');
this.gallery = document.getElementById('media-gallery');
this.errorMessage = document.getElementById('error-message');
this.recordingIndicator = document.getElementById('recording-indicator');

this.stream = null;
this.mediaRecorder = null;
this.recordedChunks = [];
this.capturedMedia = [];
this.currentCamera = 'user';
this.isRecording = false;

this.init();
}

async init() {
try {
    await this.startCamera();
    this.setupEventListeners();
} catch (error) {
    this.showError('Failed to initialize camera: ' + error.message);
}
}

async startCamera() {
try {
    const constraints = {
        video: {
            facingMode: this.currentCamera,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: true
    };
    
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    this.hideError();
} catch (error) {
    if (error.name === 'NotAllowedError') {
        this.showError('Camera access denied. Please allow camera access to use this app.');
    } else if (error.name === 'NotFoundError') {
        this.showError('No camera found. Please connect a camera and try again.');
    } else {
        this.showError('Camera access error: ' + error.message);
    }
    throw error;
}
}

async switchCamera() {
if (this.stream) {
    this.stream.getTracks().forEach(track => track.stop());
}

this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';

try {
    await this.startCamera();
} catch (error) {
    this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
    await this.startCamera();
    this.showError('Failed to switch camera. Using current camera.');
}
}

capturePhoto() {
const context = this.canvas.getContext('2d');
this.canvas.width = this.video.videoWidth;
this.canvas.height = this.video.videoHeight;
context.drawImage(this.video, 0, 0);

this.canvas.toBlob((blob) => {
    const mediaItem = {
        id: Date.now(),
        type: 'photo',
        blob: blob,
        url: URL.createObjectURL(blob),
        timestamp: new Date().toLocaleString()
    };
    
    this.capturedMedia.push(mediaItem);
    this.addToGallery(mediaItem);
}, 'image/jpeg', 0.95);
}

async startRecording() {
try {
    this.recordedChunks = [];
    
    const options = {
        mimeType: 'video/webm;codecs=vp9,opus'
    };
    
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
    }
    
    this.mediaRecorder = new MediaRecorder(this.stream, options);
    
    this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
        }
    };
    
    this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const mediaItem = {
            id: Date.now(),
            type: 'video',
            blob: blob,
            url: URL.createObjectURL(blob),
            timestamp: new Date().toLocaleString()
        };
        
        this.capturedMedia.push(mediaItem);
        this.addToGallery(mediaItem);
    };
    
    this.mediaRecorder.start();
    this.isRecording = true;
    this.updateRecordingUI();
    
} catch (error) {
    this.showError('Failed to start recording: ' + error.message);
}
}

stopRecording() {
if (this.mediaRecorder && this.isRecording) {
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.updateRecordingUI();
}
}

updateRecordingUI() {
if (this.isRecording) {
    this.recordBtn.classList.add('recording');
    this.recordBtn.innerHTML = '⏹️';
    this.recordingIndicator.classList.remove('hidden');
} else {
    this.recordBtn.classList.remove('recording');
    this.recordBtn.innerHTML = '⏺️';
    this.recordingIndicator.classList.add('hidden');
}
}

addToGallery(mediaItem) {
if (this.capturedMedia.length === 1) {
    this.gallery.innerHTML = '';
}

const mediaElement = document.createElement('div');
mediaElement.className = 'media-item';
mediaElement.dataset.id = mediaItem.id;

if (mediaItem.type === 'photo') {
    mediaElement.innerHTML = `
        <img src="${mediaItem.url}" alt="Captured photo">
        <div class="media-info">
            <div class="media-type">📷 Photo</div>
            <div class="media-timestamp">${mediaItem.timestamp}</div>
            <div class="media-actions">
                <button class="btn btn-primary download-btn" data-id="${mediaItem.id}">Download</button>
                <button class="btn btn-secondary delete-btn" data-id="${mediaItem.id}">Delete</button>
            </div>
        </div>
    `;
} else {
    mediaElement.innerHTML = `
        <video controls>
            <source src="${mediaItem.url}" type="video/webm">
            Your browser does not support the video tag.
        </video>
        <div class="media-info">
            <div class="media-type">🎥 Video</div>
            <div class="media-timestamp">${mediaItem.timestamp}</div>
            <div class="media-actions">
                <button class="btn btn-primary download-btn" data-id="${mediaItem.id}">Download</button>
                <button class="btn btn-secondary delete-btn" data-id="${mediaItem.id}">Delete</button>
            </div>
        </div>
    `;
}

this.gallery.appendChild(mediaElement);
}

downloadMedia(mediaId) {
const mediaItem = this.capturedMedia.find(item => item.id === mediaId);
if (!mediaItem) {
    return;
}

const link = document.createElement('a');
link.href = mediaItem.url;
link.download = `${mediaItem.type}_${mediaId}.${mediaItem.type === 'photo' ? 'jpg' : 'webm'}`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}

deleteMedia(mediaId) {
const mediaIndex = this.capturedMedia.findIndex(item => item.id === mediaId);
if (mediaIndex === -1) {
    return;
}

const mediaItem = this.capturedMedia[mediaIndex];
URL.revokeObjectURL(mediaItem.url);

this.capturedMedia.splice(mediaIndex, 1);

const mediaElement = document.querySelector(`.media-item[data-id="${mediaId}"]`);
if (mediaElement) {
    mediaElement.remove();
}

if (this.capturedMedia.length === 0) {
    this.gallery.innerHTML = `
        <div class="empty-state">
            <p>No media captured yet. Start taking photos or recording videos!</p>
        </div>
    `;
}
}

downloadAllMedia() {
if (this.capturedMedia.length === 0) {
    this.showError('No media to download');
    return;
}

this.capturedMedia.forEach((mediaItem, index) => {
    setTimeout(() => {
        this.downloadMedia(mediaItem.id);
    }, index * 200);
});
}

clearAllMedia() {
if (this.capturedMedia.length === 0) return;

if (confirm('Are you sure you want to delete all captured media?')) {
    this.capturedMedia.forEach(mediaItem => {
        URL.revokeObjectURL(mediaItem.url);
    });
    
    this.capturedMedia = [];
    this.gallery.innerHTML = `
        <div class="empty-state">
            <p>No media captured yet. Start taking photos or recording videos!</p>
        </div>
    `;
}
}

showError(message) {
this.errorMessage.textContent = message;
this.errorMessage.classList.remove('hidden');
}

hideError() {
this.errorMessage.classList.add('hidden');
}

setupEventListeners() {
this.captureBtn.addEventListener('click', () => this.capturePhoto());

this.recordBtn.addEventListener('click', () => {
    if (this.isRecording) {
        this.stopRecording();
    } else {
        this.startRecording();
    }
});

this.toggleCameraBtn.addEventListener('click', () => this.switchCamera());

this.clearAllBtn.addEventListener('click', () => this.clearAllMedia());

this.downloadAllBtn.addEventListener('click', () => this.downloadAllMedia());

// Event delegation for gallery buttons
this.gallery.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const mediaId = parseInt(e.target.dataset.id);
        this.downloadMedia(mediaId);
    } else if (e.target.classList.contains('delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const mediaId = parseInt(e.target.dataset.id);
        this.deleteMedia(mediaId);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && this.isRecording) {
        this.stopRecording();
    }else{
        console.log("FUCK OFF")
    }
});

window.addEventListener('beforeunload', () => {
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
    }
});
}
}

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
document.getElementById('error-message').textContent = 'Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.';
document.getElementById('error-message').classList.remove('hidden');

document.getElementById('capture-photo').disabled = true;
document.getElementById('toggle-recording').disabled = true;
document.getElementById('toggle-camera').disabled = true;
} else {
document.addEventListener('DOMContentLoaded', () => {
new CameraApp();
});
}