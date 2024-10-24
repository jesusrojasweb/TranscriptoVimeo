document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('transcriptionForm');
    const submitBtn = document.getElementById('submitBtn');
    const processingStatus = document.getElementById('processingStatus');
    const transcriptionResult = document.getElementById('transcriptionResult');
    const transcriptionText = document.getElementById('transcriptionText');
    const errorAlert = document.getElementById('errorAlert');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI
        errorAlert.classList.add('d-none');
        transcriptionResult.classList.add('d-none');
        processingStatus.classList.remove('d-none');
        submitBtn.disabled = true;

        const formData = new FormData(form);

        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                transcriptionText.textContent = data.transcription;
                transcriptionResult.classList.remove('d-none');
            } else {
                throw new Error(data.error || 'Failed to process video');
            }
        } catch (error) {
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
        } finally {
            processingStatus.classList.add('d-none');
            submitBtn.disabled = false;
        }
    });
});
