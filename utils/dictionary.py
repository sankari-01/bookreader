import requests
from utils.qa import generate_explanation
from utils.logger import log_error
from deep_translator import GoogleTranslator

def get_meaning(word, context=None, target_lang='en'):
    """
    Fetches the dictionary definition for the given word or phrase.
    Supports splitting squashed words (e.g., AshaLearns).
    Uses AI (BART/Summarizer) as a fallback for non-English words or when API fails.
    """
    if not word:
        return "Please provide a word."
    
    word = word.strip()
    target_lang = target_lang.lower().strip()
    log_error(f"Starting meaning lookup for: '{word}' (Target Lang: {target_lang})")
    
    # 1. Identify words to lookup
    looks_squashed = any(c.isupper() for c in word[1:]) if len(word) > 2 else False
    
    if looks_squashed:
        import re
        words_to_lookup = re.findall('[A-Z][^A-Z]*|[a-z]+', word)
    else:
        words_to_lookup = [word] # Try the whole phrase first

    meanings = []
    
    # Try dictionary API for each component if it's English
    for w in words_to_lookup:
        clean_word = ''.join(e for e in w if e.isalnum())
        if not clean_word or len(clean_word) < 2:
            continue
            
        try:
            # Check if word is likely non-English and translate it first
            lookup_word = clean_word.lower()
            try:
                # Use GoogleTranslator to get English version for dictionary lookup
                translated_for_lookup = GoogleTranslator(source='auto', target='en').translate(lookup_word)
                if translated_for_lookup and translated_for_lookup.lower() != lookup_word:
                    log_error(f"Translated '{lookup_word}' to '{translated_for_lookup}' for dictionary lookup.")
                    lookup_word = translated_for_lookup.lower()
            except Exception as e:
                log_error(f"Translation-for-lookup failed: {e}")

            url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{lookup_word}"
            response = requests.get(url, timeout=3)
            if response.ok:
                data = response.json()
                definition = data[0]['meanings'][0]['definitions'][0]['definition']
                
                # Granular Back-Translation: Translate ONLY the definition if target_lang is not English
                if target_lang != 'en':
                    try:
                        translated_def = GoogleTranslator(source='en', target=target_lang).translate(definition)
                        if translated_def:
                            definition = translated_def
                    except Exception as e:
                        log_error(f"Back-translation failed for definition: {e}")

                # Format the result nicely
                display_word = f"{clean_word} ({lookup_word})" if lookup_word != clean_word.lower() else clean_word
                meanings.append(f"<b>{display_word}:</b> {definition}" if len(words_to_lookup) > 1 else definition)
                log_error(f"Dictionary API success for '{lookup_word}'")
                continue
        except:
            pass
            
        # Fallback to AI Explanation if Dictionary API fails or word is likely non-English
        if context:
            log_error(f"Dictionary API failed for '{clean_word}', trying AI fallback...")
            ai_meaning = generate_explanation(w, context)
            if ai_meaning:
                # Translate AI output if needed
                if target_lang != 'en':
                    try:
                        translated_ai = GoogleTranslator(source='auto', target=target_lang).translate(ai_meaning)
                        if translated_ai:
                            ai_meaning = translated_ai
                    except:
                        pass
                
                meanings.append(f"<b>{w}:</b> {ai_meaning}" if len(words_to_lookup) > 1 else ai_meaning)
                log_error(f"AI fallback success for '{w}'")
                continue

    if meanings:
        result = "<br><br>".join(meanings)
        # Final label translation if needed
        label = "Meaning"
        if target_lang != 'en':
            try:
                label = GoogleTranslator(source='en', target=target_lang).translate(label)
            except:
                pass
        return f"<b>{label}:</b><br>{result}"
    
    # Final Emergency Fallback
    error_msg = f"Sorry, I couldn't find a definitive definition or explanation for '{word}'."
    if target_lang != 'en':
        try:
            error_msg = GoogleTranslator(source='en', target=target_lang).translate(error_msg)
        except:
            pass
    log_error(f"FAILED to find meaning for '{word}'.")
    return error_msg