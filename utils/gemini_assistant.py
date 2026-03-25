import os
import google.generativeai as genai
from dotenv import load_dotenv
from utils.logger import log_error

# Load environment variables
load_dotenv()

class GeminiAssistant:
    _is_configured = False
    _model = None

    @classmethod
    def configure(cls):
        if cls._is_configured:
            return True
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key.strip() == "" or "YOUR_GEMINI_API_KEY" in api_key:
            log_error("Valid GEMINI_API_KEY not found in environment (found placeholder or empty).")
            return False
            
        try:
            genai.configure(api_key=api_key)
            cls._model = genai.GenerativeModel('gemini-1.5-flash')
            cls._is_configured = True
            log_error("Gemini AI configured successfully.")
            return True
        except Exception as e:
            log_error(f"Failed to configure Gemini: {e}")
            return False

    @classmethod
    def ask(cls, question, context=None):
        if not cls.configure():
            return None
            
        try:
            if context:
                prompt = f"""
                You are a helpful AI Book Reader assistant. 
                Answer the following question based on the provided context from the book.
                Provide a **short, direct answer** (one sentence if possible). 
                If the answer is not in the context, use your general knowledge but keep it brief.
                
                Book Context:
                {context[:15000]}
                
                Question: {question}
                
                Answer:
                """
            else:
                prompt = f"Question: {question}\n\nAnswer as a helpful assistant:"
                
            response = cls._model.generate_content(prompt) if cls._model else None
            if response and response.text:
                return response.text.strip()
            return "Gemini returned an empty response or model not initialized."
        except Exception as e:
            log_error(f"Gemini AI Error: {e}")
            return f"AI Error: {str(e)}"

    @classmethod
    def describe_image(cls, pil_image, prompt="Describe this image in about 40 words, focusing on its context and significance."):
        if not cls.configure():
            return "AI Configuration missing. (Local OCR only)"
        try:
            # Gemini 1.5-flash handles PIL images directly in the list
            response = cls._model.generate_content([prompt, pil_image])
            if response and response.text:
                return response.text.strip()
            return "Model returned empty description."
        except Exception as e:
            log_error(f"Gemini Image Description Error: {e}")
            return f"AI Description Error: {str(e)}"
