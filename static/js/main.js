document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('transcriptionForm');
    const submitBtn = document.getElementById('submitBtn');
    const processingStatus = document.getElementById('processingStatus');
    const transcriptionResult = document.getElementById('transcriptionResult');
    const transcriptionText = document.getElementById('transcriptionText');
    const errorAlert = document.getElementById('errorAlert');
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');

    // Initialize Socket.IO connection
    const socket = io();
    let currentTaskId = null;

    function updateProgress(progress, status, message) {
        console.log('Progress update:', { progress, status, message });
        
        // Update progress bar
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        
        // Update status message with custom message if provided
        if (message) {
            progressStatus.textContent = message;
        } else {
            const statusMessages = {
                'downloading': 'Downloading video (0-30%)...',
                'converting': 'Converting video to audio (30-50%)...',
                'transcribing': 'Transcribing audio to text (50-100%). This may take several minutes...',
                'completed': 'Transcription completed successfully!',
                'error': 'Error occurred during processing'
            };
            progressStatus.textContent = statusMessages[status] || status;
        }

        // Add appropriate Bootstrap classes based on status
        progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
        if (status === 'completed') {
            progressBar.classList.add('bg-success');
        } else if (status === 'error') {
            progressBar.classList.add('bg-danger');
        } else {
            progressBar.classList.add('bg-info');
            progressBar.classList.add('bg-opacity-75');
        }
    }

    // Socket.IO event handlers
    socket.on('connect', () => {
        console.log('WebSocket connected');
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        errorAlert.textContent = 'Lost connection to server. Please refresh the page.';
        errorAlert.classList.remove('d-none');
    });

    socket.on('progress_update', (data) => {
        console.log('Progress update received:', data);
        if (data.task_id === currentTaskId) {
            updateProgress(data.progress, data.status, data.message);

            if (data.status === 'completed' && data.transcription) {
                transcriptionText.textContent = data.transcription;
                transcriptionResult.classList.remove('d-none');
                processingStatus.classList.add('d-none');
                submitBtn.disabled = false;
            } else if (data.status === 'error') {
                errorAlert.textContent = data.message || 'Failed to process video';
                errorAlert.classList.remove('d-none');
                processingStatus.classList.add('d-none');
                submitBtn.disabled = false;
            }
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI
        errorAlert.classList.add('d-none');
        transcriptionResult.classList.add('d-none');
        processingStatus.classList.remove('d-none');
        submitBtn.disabled = true;
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-info bg-opacity-75';

        const formData = new FormData(form);
        console.log('Submitting form with URL:', formData.get('video_url'));

        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log('Server response:', data);

            if (response.ok && data.task_id) {
                currentTaskId = data.task_id;
                socket.emit('join', { task_id: currentTaskId });
            } else {
                throw new Error(data.error || 'Failed to process video');
            }
        } catch (error) {
            console.error('Request error:', error);
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
            processingStatus.classList.add('d-none');
            submitBtn.disabled = false;
        }
    });
});
