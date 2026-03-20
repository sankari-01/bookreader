from utils.model_loader import AIModels
import os

def transcribe_video(path):
    """Transcribes audio from a video file using Whisper."""
    try:
        transcriber = AIModels.get_transcriber()
        # The pipeline can often handle common video formats directly if ffmpeg is installed
        # or it will attempt to decode them. For a more robust solution, we'd extract audio first.
        result = transcriber(path)
        return result.get("text", "Transcription failed.")
    except Exception as e:
        return f"Transcription error: {str(e)}"
