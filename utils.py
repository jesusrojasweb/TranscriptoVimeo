import os
import yt_dlp
from pydub import AudioSegment
import logging

logger = logging.getLogger(__name__)

def download_video(url, output_dir):
    """Download video from URL using yt-dlp."""
    try:
        ydl_opts = {
            'format': 'best',
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_path = ydl.prepare_filename(info)
            return video_path
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        return None

def convert_to_mp3(video_path):
    """Convert video file to MP3 using pydub."""
    try:
        output_path = os.path.splitext(video_path)[0] + '.mp3'
        
        # Convert video to audio
        audio = AudioSegment.from_file(video_path)
        audio.export(output_path, format="mp3")
        
        return output_path
    except Exception as e:
        logger.error(f"Error converting to MP3: {str(e)}")
        return None
