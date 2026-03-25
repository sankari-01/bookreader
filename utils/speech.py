import os
import asyncio
import edge_tts
import hashlib

VOICE_MAP = {
    'en': {'f': 'en-US-EmmaNeural', 'm': 'en-US-GuyNeural'},
    'ta': {'f': 'ta-IN-PallaviNeural', 'm': 'ta-IN-ValluvarNeural'},
    'hi': {'f': 'hi-IN-SwaraNeural', 'm': 'hi-IN-MadhurNeural'},
    'fr': {'f': 'fr-FR-VivienneNeural', 'm': 'fr-FR-RemyNeural'},
    'es': {'f': 'es-ES-ElviraNeural', 'm': 'es-ES-AlvaroNeural'},
    'de': {'f': 'de-DE-KatjaNeural', 'm': 'de-DE-KillianNeural'},
    'zh-cn': {'f': 'zh-CN-XiaoxiaoNeural', 'm': 'zh-CN-YunxiNeural'},
    'ja': {'f': 'ja-JP-NanamiNeural', 'm': 'ja-JP-KeitaNeural'},
    'ru': {'f': 'ru-RU-SvetlanaNeural', 'm': 'ru-RU-DmitryNeural'},
    'ko': {'f': 'ko-KR-SunHiNeural', 'm': 'ko-KR-BongJinNeural'},
    'te': {'f': 'te-IN-ShrutiNeural', 'm': 'te-IN-MohanNeural'},
    'kn': {'f': 'kn-IN-SapnaNeural', 'm': 'kn-IN-GaganNeural'},
    'ml': {'f': 'ml-IN-SobhanaNeural', 'm': 'ml-IN-MidhunNeural'},
    'mr': {'f': 'mr-IN-AarohiNeural', 'm': 'mr-IN-ManoharNeural'},
    'gu': {'f': 'gu-IN-DhwaniNeural', 'm': 'gu-IN-NiranjanNeural'},
    'pa': {'f': 'pa-IN-OjasNeural', 'm': 'pa-IN-ArjunNeural'},
    'bn': {'f': 'bn-IN-TanishaNeural', 'm': 'bn-IN-BashkarNeural'}
}

def text_to_speech(text, lang='en', rate='+0%', gender='f', expressive=True, is_song=False):
    """
    Synchronous wrapper for edge-tts generation.
    Returns (audio_filename, vtt_filename) stored in the static folder.
    expressive: If True, uses Gemini to add theatrical SSML tags.
    """
    if not text:
        return None, "No text provided"
        
    # Generate unique filenames based on text content, lang, rate, gender, expressive flag, and is_song
    text_hash = hashlib.md5(f"{text}_{rate}_{gender}_{expressive}_{is_song}".encode('utf-8')).hexdigest()
    audio_filename = f"speech_{text_hash}_{lang}.mp3"
    vtt_filename = f"speech_{text_hash}_{lang}.vtt"
    
    static_dir = os.path.join(os.getcwd(), 'static')
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
        
    audio_path = os.path.join(static_dir, audio_filename)
    vtt_path = os.path.join(static_dir, vtt_filename)
    
    # Check if already cached
    if os.path.exists(audio_path):
        return audio_filename, vtt_filename
        
    voice_options = VOICE_MAP.get(lang.lower(), VOICE_MAP['en'])
    voice = voice_options.get(gender, voice_options['f'])
    
    final_text = text
    if is_song:
        from utils.narration_expander import NarrationExpander
        expanded = NarrationExpander.turn_into_song(text, lang)
        if expanded and "<" in expanded:
            final_text = f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='{lang}'>{expanded}</speak>"
        else:
            final_text = expanded
    elif expressive:
        from utils.narration_expander import NarrationExpander
        expanded = NarrationExpander.theatricalize(text, lang)
        if expanded and "<" in expanded:
            # Wrap in SSML
            final_text = f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='{lang}'>{expanded}</speak>"
    
    try:
        asyncio.run(_generate_speech(final_text, voice, audio_path, vtt_path, rate))
        return audio_filename, vtt_filename
    except Exception as e:
        print(f"TTS Error: {e}")
        # Fallback to plain text if SSML failed
        if expressive:
             try:
                 asyncio.run(_generate_speech(text, voice, audio_path, vtt_path, rate))
                 return audio_filename, vtt_filename
             except: pass
        return None, str(e)

async def _generate_speech(text, voice, audio_path, vtt_path, rate='+0%'):
    is_ssml = text.strip().startswith("<speak")
    if is_ssml:
        communicate = edge_tts.Communicate(text, voice)
    else:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
    # edge-tts supports generating VTT subtitles directly
    subs = edge_tts.SubMaker()
    
    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                subs.feed(chunk)
                
    with open(vtt_path, "w", encoding="utf-8") as f:
        srt_content = subs.get_srt()
        vtt_content = "WEBVTT\n\n" + srt_content.replace(',', '.')
        f.write(vtt_content)
