from utils.model_loader import AIModels
from utils.logger import log_error
import re

def summarize_text(text):
    text = re.sub(r"\s+", " ", text).strip()

    if not text or text.startswith("Preview not supported") or text.startswith("No readable text found"):
        return "No readable text found to summarize."

    # Split text into chunks
    words = text.split()
    total_words = len(words)
    chunk_size = 800
    
    # Stratified sampling for whole-book coverage
    # Stratified sampling for whole-book coverage - optimized for speed
    num_chunks = min(2, (total_words // chunk_size) + 1)
    chunks = []
    
    if total_words <= chunk_size * num_chunks:
        chunks = [" ".join(words[i:i + chunk_size]) for i in range(0, total_words, chunk_size)]
    else:
        # Sample only from the beginning and middle for speed
        indices = [0, total_words // 2]
        indices = sorted(list(set([max(0, i) for i in indices])))
        for idx in indices:
            chunks.append(" ".join(words[idx : idx + chunk_size]))
    
    try:
        summarizer_model, summarizer_tokenizer = AIModels.get_summarizer()
    except Exception as e:
        log_error(f"Failed to load summarizer: {str(e)}")
        return "Initialization error for summarizer."
    
    full_summary = []
    try:
        for chunk in chunks:
            if len(chunk.split()) < 30: continue
            inputs = summarizer_tokenizer(chunk, max_length=1024, truncation=True, return_tensors="pt")
            summary_ids = summarizer_model.generate(
                inputs["input_ids"], min_length=20, max_length=45, length_penalty=1.0, num_beams=2, early_stopping=True
            )
            summary_text = summarizer_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
            full_summary.append(summary_text.strip())
    except Exception as e:
        log_error(f"Summarization error: {str(e)}")
        return f"Error during summarization: {str(e)}"

    return " ".join(full_summary).strip()