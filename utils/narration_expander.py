import os
from utils.gemini_assistant import GeminiAssistant
from utils.logger import log_error

class NarrationExpander:
    @classmethod
    def theatricalize(cls, text, lang='en'):
        """
        Uses Gemini to add SSML tags for expressive narration.
        Supported tags in edge-tts: <break time="Xms"/>, <prosody pitch="X" rate="X" volume="X">
        """
        if not text or len(text.strip()) < 10:
            return text
            
        if not GeminiAssistant.configure():
            return cls._manual_theater(text, lang)
            
        prompt = f"""
        You are a producer for a high-quality audiobook. 
        Enhance the following text with SSML tags to make the narration sound expressive, theatrical, and real.
        Use <break time="300ms"/> for dramatic pauses.
        Use <prosody pitch="+5%" rate="-10%"> for emphasized or emotional parts.
        Use <prosody pitch="-5%" rate="+10%"> for fast-paced or exciting parts.
        
        IMPORTANT: 
        1. Keep the output as valid SSML content (just the inner body, no <speak> tags needed yet).
        2. DO NOT change the original words or language. 
        3. If the language is Tamil or another, maintain the same language but add tags at appropriate emotional boundaries.
        4. Focus on making it sound like a human telling an incident.
        
        Text to enhance:
        {text}
        
        SSML Result:
        """
        
        try:
            enhanced = GeminiAssistant.ask(prompt)
            if enhanced and "<" in enhanced:
                # Basic cleaning to ensure no code block markers
                enhanced = enhanced.replace("```xml", "").replace("```ssml", "").replace("```", "").strip()
                return enhanced
            return cls._manual_theater(text, lang)
        except Exception as e:
            log_error(f"Narration expansion error: {e}")
            return cls._manual_theater(text, lang)

    @classmethod
    def _manual_theater(cls, text, lang='en'):
        """
        Slightly enhance text with pauses and mild pitch shifts for natural feel.
        """
        if not text: return ""
        clean_text = text.replace("<", "&lt;").replace(">", "&gt;")
        sentences = clean_text.split('. ')
        ssml_parts = []
        for i, sent in enumerate(sentences):
            if not sent.strip(): continue
            # Alternate pitch and rate for natural flow
            pitch = "+4%" if i % 2 == 0 else "-3%"
            rate = "-5%" if i % 3 == 0 else "+2%"
            ssml_parts.append(f'<prosody pitch="{pitch}" rate="{rate}">{sent}.</prosody>')
            ssml_parts.append('<break time="200ms"/>')
        return "".join(ssml_parts)

    @classmethod
    def turn_into_song(cls, text, lang='en'):
        """
        Uses Gemini to rewrite the text into a kid-friendly rhyme or song.
        """
        if not text or len(text.strip()) < 10:
            return text
            
        if not GeminiAssistant.configure():
            return cls._manual_rhythm(text, lang)
            
        prompt = f"""
        You are a talented children's music composer and audio engineer.
        Rewrite the following text into a fun, upbeat, rhyming song or nursery rhyme for kids.
        
        CRITICAL INSTRUCTIONS TO MAKE THE VOICE SING (SSML):
        1. Use <mstts:express-as style="cheerful"> for the entire song to make it joyful.
        2. Use <prosody> tags with EXTREME pitch variations to create a melody. 
           Example: <prosody pitch="+50%" rate="slow">Low to </prosody><prosody pitch="+150%" rate="medium">HIGH!</prosody>
        3. Use the `contour` attribute to simulate singing notes. 
           Example: <prosody contour="(0%,+20Hz) (10%,-20Hz) (40%,+10Hz) (100%,+30Hz)">
        4. Insert <break time="400ms"/> between lines to maintain a "beat".
        5. DO NOT use markdown blocks. ONLY output the SSML inner text.
        6. Keep it to 2-4 lines of catchy rhyming text.
        7. If the language requested is not English ({lang}), write the lyrics and tags in that language.
        
        Text:
        {text}
        
        Melodic SSML Lyrics:
        """
        
        try:
            song_lyrics = GeminiAssistant.ask(prompt)
            if song_lyrics and "AI Error" not in song_lyrics:
                # Basic cleaning
                song_lyrics = song_lyrics.replace("```xml", "").replace("```ssml", "").replace("```", "").strip()
                return song_lyrics
            return cls._manual_rhythm(text, lang)
        except Exception as e:
            log_error(f"Song conversion error: {e}")
            return cls._manual_rhythm(text, lang)

    @classmethod
    def _manual_rhythm(cls, text, lang='en'):
        """
        Fallback when AI is unavailable. 
        Manually injects pitch-shifting prosody tags to simulate a sing-song voice.
        """
        if not text: return ""
        # Clean text from existing tags just in case
        clean_text = text.replace("<", "&lt;").replace(">", "&gt;")
        
        # Split into phrases (roughly 4-6 words)
        words = clean_text.split()
        if not words: return ""
        
        chunks = [" ".join(words[i:i+6]) for i in range(0, len(words), 6)]
        
        ssml_parts = []
        pitches = ["+40%", "+120%", "-10%", "+90%", "+150%", "+30%"]
        contours = [
            "(0%,+20Hz) (50%,+40Hz) (100%,+10Hz)",
            "(0%,+10Hz) (40%,-30Hz) (100%,+50Hz)",
            "(0%,+40Hz) (60%,+10Hz) (100%,+60Hz)",
            "(0%,-10Hz) (50%,+50Hz) (100%,-20Hz)"
        ]
        
        for i, chunk in enumerate(chunks):
            pitch = pitches[i % len(pitches)]
            contour = contours[i % len(contours)]
            # Use mstts:express-as if it's English, otherwise just prosody
            if lang.lower() == 'en':
                ssml_parts.append(f'<mstts:express-as style="cheerful"><prosody pitch="{pitch}" contour="{contour}">{chunk}</prosody></mstts:express-as>')
            else:
                ssml_parts.append(f'<prosody pitch="{pitch}" contour="{contour}">{chunk}</prosody>')
            
            if i < len(chunks) - 1:
                ssml_parts.append('<break time="450ms"/>')
        
        return "".join(ssml_parts)
