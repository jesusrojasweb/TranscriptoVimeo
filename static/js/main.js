document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('transcriptionForm');
    const submitBtn = document.getElementById('submitBtn');
    const processingStatus = document.getElementById('processingStatus');
    const transcriptionResult = document.getElementById('transcriptionResult');
    const transcriptionText = document.getElementById('transcriptionText');
    const errorAlert = document.getElementById('errorAlert');
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');

    let eventSource = null;

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

    function cleanupEventSource() {
        if (eventSource) {
            console.log('Closing EventSource connection');
            eventSource.close();
            eventSource = null;
        }
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI
        cleanupEventSource();
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
                // Set up SSE connection
                console.log('Establishing SSE connection for task:', data.task_id);
                eventSource = new EventSource(`/progress/${data.task_id}`);
                
                eventSource.onmessage = function(event) {
                    console.log('SSE message received:', event.data);
                    const progressData = JSON.parse(event.data);
                    updateProgress(
                        progressData.progress,
                        progressData.status,
                        progressData.message
                    );

                    if (progressData.status === 'completed') {
                        console.log('Transcription completed');
                        transcriptionText.textContent = progressData.transcription;
                        transcriptionResult.classList.remove('d-none');
                        cleanupEventSource();
                        processingStatus.classList.add('d-none');
                        submitBtn.disabled = false;
                    } else if (progressData.status === 'error') {
                        console.error('Transcription error:', progressData.message);
                        errorAlert.textContent = progressData.message || 'Failed to process video';
                        errorAlert.classList.remove('d-none');
                        processingStatus.classList.add('d-none');
                        submitBtn.disabled = false;
                        cleanupEventSource();
                    }
                };

                eventSource.onerror = function(error) {
                    console.error('SSE connection error:', error);
                    cleanupEventSource();
                    errorAlert.textContent = 'Lost connection to server';
                    errorAlert.classList.remove('d-none');
                    processingStatus.classList.add('d-none');
                    submitBtn.disabled = false;
                };
            } else {
                throw new Error(data.error || 'Failed to process video');
            }
        } catch (error) {
            console.error('Request error:', error);
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
            processingStatus.classList.add('d-none');
            submitBtn.disabled = false;
            cleanupEventSource();
        }
    });
});
