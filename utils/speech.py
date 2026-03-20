import asyncio
import edge_tts
import re
from utils.logger import log_error
import hashlib
import os
import glob
import time

# Best neural voices for each language — chosen for expressiveness & naturalness
VOICE_MAP = {
    "en":    "en-US-AriaNeural",        # Most expressive English voice; supports narration, chat, excited etc.
    "es":    "es-ES-ElviraNeural",
    "fr":    "fr-FR-DeniseNeural",
    "de":    "de-DE-AmalaNeural",
    "ta":    "ta-IN-PallaviNeural",
    "hi":    "hi-IN-SwaraNeural",
    "zh-CN": "zh-CN-XiaoxiaoNeural",   # Also very expressive for Chinese
    "ja":    "ja-JP-NanamiNeural",
    "ru":    "ru-RU-SvetlanaNeural",
    "ko":    "ko-KR-SunHiNeural",
    "te":    "te-IN-ShrutiNeural",
    "kn":    "kn-IN-SapnaNeural",
    "ml":    "ml-IN-SobhanaNeural",
    "mr":    "mr-IN-AarohiNeural",
    "gu":    "gu-IN-DhwaniNeural",
    "pa":    "pa-IN-OjasNeural",
    "bn":    "bn-IN-TanishaaNeural",
}

# Voices that officially support SSML <mstts:express-as> styles
SSML_STYLE_VOICES = {
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-YunxiNeural",
    "ja-JP-NanamiNeural",
}

def _escape(text):
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))

def _clean(text):
    """Remove book markers and normalise whitespace."""
    text = re.sub(r'--- (?:Page|Slide) \d+ ---', '', text)
    text = re.sub(r'\.{3,}', '...', text)
    text = re.sub(r'-{3,}', ' — ', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def _classify_sentence(sentence):
    """Return an (ssml_style, rate, pitch) tuple for a sentence."""
    s = sentence.lower()

    # Shouting / high-energy action
    if re.search(r'\b(shout|yell|scream|exclaim|roar|bellow|cry out)\w*\b', s):
        return ("excited", "+15%", "+5Hz")

    # Whispering / soft speech
    if re.search(r'\b(whisper|murmur|breathe|hiss|mutter)\w*\b', s):
        return (None, "-25%", "-4Hz")  # No style tag — use prosody only for silence

    # Sadness / empathy
    if re.search(r'\b(sob|weep|grieve|mourn|sigh|tear|cry)\w*\b', s):
        return ("empathetic", "-12%", "-2Hz")

    # Suspense / mystery
    if re.search(r'\b(suddenly|shadow|darken|mysterious|strange|creak|silence|appear|vanish)\w*\b', s):
        return ("narration-professional", "-18%", "-1Hz")

    # Dialogue (text in any quote style)
    if re.search(r'["\u201c\u201d\u2018\u2019]', sentence):
        return ("chat", "-5%", "+1Hz")

    # Default narration
    return ("narration-professional", "-5%", "+0Hz")

def build_ssml(text, voice, lang="en"):
    """
    Build an expressive SSML document from plain text.

    Applies different prosody / styles sentence-by-sentence:
    - Dialogue → chat style
    - Action / excitement → excited style  
    - Whispers → soft prosody
    - Sadness → empathetic style
    - Suspense → slower narration-professional
    - Normal narration → narration-professional baseline
    """
    text = _clean(text)
    if not text:
        return None

    supports_styles = voice in SSML_STYLE_VOICES

    # Split into paragraphs then sentences
    paragraphs = [p.strip() for p in re.split(r'\n\n+|\n', text) if p.strip()]
    body_parts = []

    for para in paragraphs:
        sentences = re.split(r'(?<=[.!?…])\s+', para)
        for raw_sent in sentences:
            sent = raw_sent.strip()
            if not sent:
                continue

            style, rate, pitch = _classify_sentence(sent)
            esc = _escape(sent)

            if supports_styles and style:
                part = (
                    f'<mstts:express-as style="{style}">'
                    f'<prosody rate="{rate}" pitch="{pitch}">{esc}</prosody>'
                    f'</mstts:express-as>'
                )
            else:
                # Fallback for non-SSML-style voices — just use prosody
                part = f'<prosody rate="{rate}" pitch="{pitch}">{esc}</prosody>'

            body_parts.append(part)

        # Natural paragraph pause
        body_parts.append('<break time="700ms"/>')

    inner = '\n        '.join(body_parts)

    # Determine xml:lang value
    lang_xml = {
        "en": "en-US", "ta": "ta-IN", "hi": "hi-IN", "fr": "fr-FR",
        "es": "es-ES", "de": "de-DE", "zh-CN": "zh-CN", "ja": "ja-JP",
        "ru": "ru-RU", "ko": "ko-KR", "te": "te-IN", "kn": "kn-IN",
        "ml": "ml-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN", "bn": "bn-IN",
    }.get(lang, "en-US")

    return f'''<speak version="1.0"
    xmlns="http://www.w3.org/2001/10/synthesis"
    xmlns:mstts="http://www.w3.org/2001/mstts"
    xml:lang="{lang_xml}">
  <voice name="{voice}">
    {inner}
  </voice>
</speak>'''


def text_to_speech(text, lang="en"):
    try:
        if not text or not text.strip():
            return None, "No text"

        voice = VOICE_MAP.get(lang, "en-US-AriaNeural")
        
        # Unique filename based on hash to avoid browser caching issues or file locks
        h = hashlib.md5(f"{text}_{voice}".encode()).hexdigest()[:12]
        audio_filename = f"audio_{h}.mp3"
        vtt_filename = f"subtitles_{h}.vtt"
        
        output_file = os.path.join("static", audio_filename)
        vtt_file = os.path.join("static", vtt_filename)

        # Cleanup old audio files (only keep current and a few recent ones)
        try:
            old_files = glob.glob(os.path.join("static", "audio_*.mp3")) + glob.glob(os.path.join("static", "subtitles_*.vtt"))
            # Sort by time and keep only the 20 most recent
            old_files.sort(key=os.path.getmtime, reverse=True)
            for f in old_files[20:]:
                os.remove(f)
        except Exception:
            pass

        # If already exists, don't re-generate (saves time and quota)
        if os.path.exists(output_file) and os.path.getsize(output_file) > 1000:
             return audio_filename, vtt_filename

        # Try to build expressive SSML
        ssml = build_ssml(text, voice, lang)
        log_error(f"TTS: lang={lang}, voice={voice}, ssml={'yes' if ssml else 'no'}, h={h}")

        # FORCE PLAIN TEXT NARRATION: 100% Guaranteed to not read XML namespaces or version tags.
        # This addresses the user's report of "hhtp.www" and "version 1.0" being read.
        clean_text = _clean(text)
        # Using a default rate/pitch that sounds "natural" for Neural voices
        communicate = edge_tts.Communicate(clean_text, voice, rate="-4%", pitch="+0Hz")

        async def generate_and_save():
            submaker = edge_tts.SubMaker()
            with open(output_file, "wb") as audio_f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        submaker.feed(chunk)

            srt_content = submaker.get_srt()
            vtt_content = "WEBVTT\n\n" + srt_content.replace(",", ".")
            with open(vtt_file, "w", encoding="utf-8") as vtt_f:
                vtt_f.write(vtt_content)

        asyncio.run(generate_and_save())
        log_error(f"TTS: Audio generated successfully for h={h}")
        return audio_filename, vtt_filename

    except Exception as e:
        log_error(f"TTS Error: {str(e)}")
        return None, str(e)