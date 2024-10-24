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

    // Helper function for status messages
    function getStatusMessage(status, progress) {
        switch(status) {
            case 'downloading':
                return `Downloading video (${progress}%)...`;
            case 'converting':
                return `Converting to audio (${progress}%)...`;
            case 'transcribing':
                return `Transcribing audio (${progress}%). This may take several minutes...`;
            case 'completed':
                return 'Transcription completed successfully!';
            default:
                return `Processing (${progress}%)...`;
        }
    }

    function updateProgress(progress, status, message) {
        console.log('Progress update:', { progress, status, message });
        
        // Update progress bar
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        
        // Update status message with custom message if provided
        progressStatus.textContent = message || getStatusMessage(status, progress);

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
        errorAlert.classList.add('d-none');
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        errorAlert.textContent = 'Connection lost. Please refresh the page.';
        errorAlert.classList.remove('d-none');
    });

    socket.on('reconnect', () => {
        console.log('WebSocket reconnected');
        errorAlert.classList.add('d-none');
        if (currentTaskId) {
            socket.emit('join', { task_id: currentTaskId });
        }
    });

    socket.on('progress_update', (data) => {
        console.log('Progress update received:', data);
        if (data.task_id === currentTaskId) {
            // Update progress bar and status
            updateProgress(data.progress, data.status, data.message);

            // Handle completion
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
