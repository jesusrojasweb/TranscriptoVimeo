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

    function updateProgress(progress, status) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
        
        const statusMessages = {
            'downloading': 'Downloading video...',
            'converting': 'Converting video to audio...',
            'transcribing': 'Transcribing audio...',
            'completed': 'Transcription completed!',
            'error': 'Error occurred during processing'
        };
        
        progressStatus.textContent = statusMessages[status] || status;
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
                    updateProgress(progressData.progress, progressData.status);

                    if (progressData.status === 'completed') {
                        transcriptionText.textContent = progressData.transcription;
                        transcriptionResult.classList.remove('d-none');
                        cleanupEventSource();
                        processingStatus.classList.add('d-none');
                        submitBtn.disabled = false;
                    } else if (progressData.status === 'error') {
                        throw new Error('Failed to process video');
                    }
                };

                eventSource.onerror = function() {
                    cleanupEventSource();
                    throw new Error('Lost connection to server');
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
