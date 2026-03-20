import requests
from utils.qa import generate_explanation
from utils.logger import log_error

def get_meaning(word, context=None):
    """
    Fetches the dictionary definition for the given word or phrase.
    Supports splitting squashed words (e.g., AshaLearns).
    Uses AI (BART/Summarizer) as a fallback for non-English words or when API fails.
    """
    if not word:
        return "Please provide a word."
    
    word = word.strip()
    log_error(f"Starting meaning lookup for: '{word}'")
    
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
            # Dictionary API is strictly English
            url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{clean_word.lower()}"
            response = requests.get(url, timeout=3)
            if response.ok:
                data = response.json()
                definition = data[0]['meanings'][0]['definitions'][0]['definition']
                meanings.append(f"<b>{clean_word}:</b> {definition}" if len(words_to_lookup) > 1 else definition)
                log_error(f"Dictionary API success for '{clean_word}'")
                continue
        except:
            pass
            
        # Fallback to AI Explanation if Dictionary API fails or word is likely non-English
        if context:
            log_error(f"Dictionary API failed for '{clean_word}', trying AI fallback...")
            ai_meaning = generate_explanation(w, context)
            if ai_meaning:
                meanings.append(f"<b>{w}:</b> {ai_meaning}" if len(words_to_lookup) > 1 else ai_meaning)
                log_error(f"AI fallback success for '{w}'")
                continue

    if meanings:
        result = "<br><br>".join(meanings)
        return f"<b>Meaning:</b><br>{result}"
    
    # Final Emergency Fallback: If no context or AI failed, just say it's not found
    log_error(f"FAILED to find meaning for '{word}'.")
    return f"Sorry, I couldn't find a definitive definition or explanation for '{word}'."