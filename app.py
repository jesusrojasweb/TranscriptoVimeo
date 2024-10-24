import os
import tempfile
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import whisper
from utils import download_video, convert_to_wav, validate_audio_file
import logging

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-here')

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load Whisper model (using small model for faster processing)
try:
    logger.info("Loading Whisper model...")
    model = whisper.load_model("small")
    logger.info("Whisper model loaded successfully")
except Exception as e:
    logger.error(f"Error loading Whisper model: {str(e)}")
    raise

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
            logger.info(f"Processing video URL: {video_url}")
            
            # Download video
            video_path = download_video(video_url, temp_dir)
            if not video_path:
                return jsonify({'error': 'Failed to download video'}), 400

            # Convert to WAV
            audio_path = convert_to_wav(video_path)
            if not audio_path:
                return jsonify({'error': 'Failed to convert video to audio'}), 400

            # Verify audio file before transcription
            if not validate_audio_file(audio_path):
                return jsonify({'error': 'Invalid audio file generated'}), 400

            try:
                # Transcribe
                logger.info("Starting transcription...")
                result = model.transcribe(audio_path)
                logger.info("Transcription completed successfully")
                
                return jsonify({
                    'success': True,
                    'transcription': result['text']
                })
            except Exception as e:
                logger.error(f"Transcription error: {str(e)}")
                return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return jsonify({'error': str(e)}), 500
