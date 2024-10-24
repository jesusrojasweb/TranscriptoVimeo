import os
import tempfile
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import whisper
from utils import download_video, convert_to_mp3
import logging

app = Flask(__name__)
app.secret_key = "your-secret-key-here"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Whisper model (using small model for faster processing)
model = whisper.load_model("small")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    video_url = request.form.get('video_url')
    if not video_url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Download video
            video_path = download_video(video_url, temp_dir)
            if not video_path:
                return jsonify({'error': 'Failed to download video'}), 400

            # Convert to MP3
            audio_path = convert_to_mp3(video_path)
            if not audio_path:
                return jsonify({'error': 'Failed to convert video to audio'}), 400

            # Transcribe
            result = model.transcribe(audio_path)
            
            return jsonify({
                'success': True,
                'transcription': result['text']
            })

    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return jsonify({'error': str(e)}), 500

