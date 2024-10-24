import os
import yt_dlp
from pydub import AudioSegment
import logging
import wave

logger = logging.getLogger(__name__)

def validate_audio_file(audio_path, format_type="wav"):
    """Validate that audio file exists and has content."""
    if not os.path.exists(audio_path):
        logger.error(f"Audio file does not exist: {audio_path}")
        return False
        
    file_size = os.path.getsize(audio_path)
    if file_size == 0:
        logger.error(f"Audio file is empty: {audio_path}")
        return False
        
    logger.info(f"Audio file validated: {audio_path}, size: {file_size} bytes")
    
    try:
        if format_type == "wav":
            with wave.open(audio_path, 'rb') as wav_file:
                # Get basic WAV file properties
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                frame_rate = wav_file.getframerate()
                frames = wav_file.getnframes()
                
                logger.info(f"WAV file properties - channels: {channels}, "
                          f"sample_width: {sample_width}, frame_rate: {frame_rate}, "
                          f"frames: {frames}")
                
                if frames == 0:
                    logger.error("WAV file contains no audio frames")
                    return False
    except Exception as e:
        logger.error(f"Error validating audio file format: {str(e)}")
        return False
        
    return True

def download_video(url, output_dir, progress_callback=None):
    """Download video from URL using yt-dlp."""
    try:
        def progress_hook(d):
            if d['status'] == 'downloading':
                # Calculate download progress
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded_bytes = d.get('downloaded_bytes', 0)
                if total_bytes > 0:
                    progress = (downloaded_bytes / total_bytes) * 30  # Scale to 0-30%
                    if progress_callback:
                        progress_callback(min(30, max(10, int(progress))), 'downloading')
                        
            elif d['status'] == 'finished':
                if progress_callback:
                    progress_callback(30, 'downloading')

        ydl_opts = {
            'format': 'best',
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [progress_hook],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_path = ydl.prepare_filename(info)
            
            if not os.path.exists(video_path):
                logger.error(f"Downloaded video file does not exist: {video_path}")
                return None
                
            file_size = os.path.getsize(video_path)
            logger.info(f"Video downloaded successfully: {video_path}, size: {file_size} bytes")
            
            return video_path
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        return None

def convert_to_wav(video_path, progress_callback=None):
    """Convert video file to WAV using pydub."""
    try:
        output_path = os.path.splitext(video_path)[0] + '.wav'
        
        # Start conversion progress
        if progress_callback:
            progress_callback(35, 'converting')
        
        # Convert video to audio
        logger.info(f"Starting audio conversion: {video_path} -> {output_path}")
        audio = AudioSegment.from_file(video_path)
        
        # Update progress during conversion
        if progress_callback:
            progress_callback(40, 'converting')
        
        # Export as WAV with specific parameters
        audio = audio.set_channels(1)  # Convert to mono
        audio = audio.set_frame_rate(16000)  # Set sample rate to 16kHz
        
        if progress_callback:
            progress_callback(45, 'converting')
            
        audio.export(output_path, format="wav")
        
        # Validate the converted audio
        if not validate_audio_file(output_path, "wav"):
            return None
            
        # Conversion complete
        if progress_callback:
            progress_callback(50, 'converting')
            
        return output_path
    except Exception as e:
        logger.error(f"Error converting to WAV: {str(e)}")
        return None
