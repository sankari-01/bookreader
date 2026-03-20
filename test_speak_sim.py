import sys
import os
import asyncio
import hashlib
import json

# Mocking utils.speech dependencies
from utils.speech import text_to_speech, build_ssml, VOICE_MAP

def test_speak_sim():
    text = "Hello, this is a test of the read aloud feature. I hope it works correctly."
    lang = "en"
    
    print(f"Testing TTS for lang: {lang}")
    audio_file, vtt_file = text_to_speech(text, lang)
    
    if audio_file:
        path = os.path.join("static", audio_file)
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"Success! Audio generated: {audio_file} ({size} bytes)")
        else:
            print(f"Error: Audio file {path} not found on disk.")
    else:
        print(f"Error: text_to_speech returned None. (VTT: {vtt_file})")

    # Repeat for Tamil
    text_ta = "வணக்கம், இது ஒரு சோதனை."
    lang_ta = "ta"
    print(f"\nTesting TTS for lang: {lang_ta}")
    audio_file_ta, vtt_file_ta = text_to_speech(text_ta, lang_ta)
    
    if audio_file_ta:
        path_ta = os.path.join("static", audio_file_ta)
        if os.path.exists(path_ta):
            size_ta = os.path.getsize(path_ta)
            print(f"Success! Tamil audio generated: {audio_file_ta} ({size_ta} bytes)")
        else:
            print(f"Error: Tamil audio file {path_ta} not found on disk.")
    else:
        print(f"Error: Tamil text_to_speech returned None. (VTT: {vtt_file_ta})")

if __name__ == "__main__":
    test_speak_sim()
