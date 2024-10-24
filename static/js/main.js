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
        // Update progress bar
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        
        // Update status message with custom message if provided
        if (message) {
            progressStatus.textContent = message;
        } else {
            const statusMessages = {
                'downloading': 'Downloading video from source...',
                'converting': 'Converting video to audio format...',
                'transcribing': 'Transcribing audio to text (this may take several minutes)...',
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
            progressBar.classList.add('bg-primary');
        }
    }

    function cleanupEventSource() {
        if (eventSource) {
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
        progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-primary';

        const formData = new FormData(form);

        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.task_id) {
                // Set up SSE connection
                eventSource = new EventSource(`/progress/${data.task_id}`);
                
                eventSource.onmessage = function(event) {
                    const progressData = JSON.parse(event.data);
                    updateProgress(
                        progressData.progress,
                        progressData.status,
                        progressData.message
                    );

                    if (progressData.status === 'completed') {
                        transcriptionText.textContent = progressData.transcription;
                        transcriptionResult.classList.remove('d-none');
                        cleanupEventSource();
                        processingStatus.classList.add('d-none');
                        submitBtn.disabled = false;
                    } else if (progressData.status === 'error') {
                        errorAlert.textContent = progressData.message || 'Failed to process video';
                        errorAlert.classList.remove('d-none');
                        processingStatus.classList.add('d-none');
                        submitBtn.disabled = false;
                        cleanupEventSource();
                    }
                };

                eventSource.onerror = function() {
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
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
            processingStatus.classList.add('d-none');
            submitBtn.disabled = false;
            cleanupEventSource();
        }
    });
});
