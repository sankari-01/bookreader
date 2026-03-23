import requests
from utils.qa import generate_explanation
from utils.logger import log_error
from deep_translator import GoogleTranslator

def get_meaning(word, context=None, target_lang='en'):
    """
    Fetches the dictionary definition for the given word or phrase.
    Supports multi-lingual lookup via automatic translation to English for API lookup,
    and fallback to AI explanation if API fails.
    """
    if not word:
        return "Please provide a word."
    
    word = word.strip()
    target_lang = target_lang.lower().strip()
    log_error(f"Dictionary lookup: '{word}' (Target: {target_lang})")
    
    # 1. Clean and identify word
    # Split squashed words if needed (e.g. CamelCase)
    if any(c.isupper() for c in word[1:]) and len(word) > 2:
        import re
        words_to_lookup = re.findall('[A-Z][^A-Z]*|[a-z]+', word)
    else:
        words_to_lookup = [word]

    meanings = []
    
    for w in words_to_lookup:
        # Remove punctuation for cleaner lookup
        clean_word = ''.join(e for e in w if e.isalnum() or e in ["'", "-", " "]).strip()
        if not clean_word: continue
            
        try:
            # 2. Convert to English for standard API lookup
            lookup_word = clean_word
            is_non_english = False
            try:
                # Detect and translate to English for reliable dictionary lookup
                translator = GoogleTranslator(source='auto', target='en')
                translated = translator.translate(clean_word)
                if translated and translated.lower() != clean_word.lower():
                    lookup_word = translated
                    is_non_english = True
                    log_error(f"Lookup translated '{clean_word}' -> '{lookup_word}'")
            except Exception as e:
                log_error(f"Dictionary translation error: {e}")

            # 3. Try Free Dictionary API
            url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{lookup_word.lower()}"
            response = requests.get(url, timeout=4)
            if response.ok:
                data = response.json()
                # Get the first definition
                first_entry = data[0]
                first_meaning = first_entry['meanings'][0]
                definition = first_meaning['definitions'][0]['definition']
                part_of_speech = first_meaning.get('partOfSpeech', '')
                
                # Format: [Part] Definition
                result_text = f"<i>({part_of_speech})</i> {definition}" if part_of_speech else definition
                
                # Translate back to target language if needed
                if target_lang != 'en':
                    try:
                        result_text = GoogleTranslator(source='en', target=target_lang).translate(result_text)
                    except: pass
                
                display_title = f"{w} ({lookup_word})" if is_non_english else w
                meanings.append(f"<b>{display_title}:</b> {result_text}")
                continue
        except Exception as e:
            log_error(f"API Lookup failed for '{w}': {e}")
            
        # 4. Fallback to AI Explanation
        log_error(f"Trying AI fallback for '{w}'...")
        ai_meaning = generate_explanation(w, context if context else f"Explain the meaning of the word '{w}'.")
            
        if ai_meaning:
            # Translate AI output if target is not English
            if target_lang != 'en':
                try:
                    ai_meaning = GoogleTranslator(source='auto', target=target_lang).translate(ai_meaning)
                except: pass
            meanings.append(f"<b>{w}:</b> {ai_meaning}")
            continue

    if meanings:
        # Final result formatting
        final_html = "<br><br>".join(meanings)
        # Translate the header "Meaning"
        label = "Meaning"
        if target_lang != 'en':
            try:
                label = GoogleTranslator(source='en', target=target_lang).translate(label)
            except: pass
        return f"<div class='dictionary-entry'><strong>{label}:</strong><br>{final_html}</div>"
    
    # Final Fallback
    error_msg = f"Sorry, I couldn't find a definitive meaning for '{word}'."
    if target_lang != 'en':
        try:
            error_msg = GoogleTranslator(source='en', target=target_lang).translate(error_msg)
        except: pass
    return error_msg