import os
import tempfile
from flask import Flask, render_template, request, jsonify, Response
from werkzeug.utils import secure_filename
import whisper
from utils import download_video, convert_to_wav, validate_audio_file
import logging
import time
import json

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key-here')

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Dictionary to store transcription progress
transcription_progress = {}

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

def generate_progress_events(task_id):
    """Generate server-sent events for progress updates."""
    last_progress = None
    while True:
        if task_id in transcription_progress:
            progress = transcription_progress[task_id]
            # Only send event if progress has changed
            if progress != last_progress:
                data = json.dumps({
                    'progress': progress['progress'],
                    'status': progress['status'],
                    'message': progress.get('message', ''),
                    'transcription': progress.get('transcription', '')
                })
                yield f"data: {data}\n\n"
                last_progress = progress.copy()
            
            if progress['status'] in ['completed', 'error']:
                break
        time.sleep(0.5)

@app.route('/progress/<task_id>')
def progress(task_id):
    """Stream progress updates for a specific task."""
    return Response(generate_progress_events(task_id),
                   mimetype='text/event-stream')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    video_url = request.form.get('video_url')
    if not video_url:
        return jsonify({'error': 'No URL provided'}), 400

    # Generate a unique task ID
    task_id = str(int(time.time()))
    transcription_progress[task_id] = {
        'progress': 0,
        'status': 'downloading',
        'message': 'Initiating video download...'
    }

    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Processing video URL: {video_url}")
            
            # Download video
            video_path = download_video(video_url, temp_dir)
            if not video_path:
                transcription_progress[task_id].update({
                    'status': 'error',
                    'message': 'Failed to download video'
                })
                return jsonify({'error': 'Failed to download video', 'task_id': task_id}), 400

            transcription_progress[task_id].update({
                'progress': 30,
                'status': 'converting',
                'message': 'Converting video to audio format...'
            })

            # Convert to WAV
            audio_path = convert_to_wav(video_path)
            if not audio_path:
                transcription_progress[task_id].update({
                    'status': 'error',
                    'message': 'Failed to convert video to audio'
                })
                return jsonify({'error': 'Failed to convert video to audio', 'task_id': task_id}), 400

            transcription_progress[task_id].update({
                'progress': 50,
                'status': 'transcribing',
                'message': 'Starting transcription process (this may take several minutes)...'
            })

            # Verify audio file before transcription
            if not validate_audio_file(audio_path):
                transcription_progress[task_id].update({
                    'status': 'error',
                    'message': 'Invalid audio file generated'
                })
                return jsonify({'error': 'Invalid audio file generated', 'task_id': task_id}), 400

            try:
                # Transcribe
                logger.info("Starting transcription...")
                result = model.transcribe(audio_path)
                logger.info("Transcription completed successfully")
                
                transcription_progress[task_id].update({
                    'progress': 100,
                    'status': 'completed',
                    'message': 'Transcription completed successfully!',
                    'transcription': result['text']
                })
                
                return jsonify({
                    'success': True,
                    'task_id': task_id
                })
            except Exception as e:
                logger.error(f"Transcription error: {str(e)}")
                transcription_progress[task_id].update({
                    'status': 'error',
                    'message': f'Transcription failed: {str(e)}'
                })
                return jsonify({'error': f'Transcription failed: {str(e)}', 'task_id': task_id}), 500

    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        transcription_progress[task_id].update({
            'status': 'error',
            'message': str(e)
        })
        return jsonify({'error': str(e), 'task_id': task_id}), 500
