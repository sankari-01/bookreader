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
            return text
            
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
            return text
        except Exception as e:
            log_error(f"Narration expansion error: {e}")
            return text
