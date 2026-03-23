from utils.model_loader import AIModels
from utils.logger import log_error
import re

def strip_markers(text):
    """Removes --- Page X --- and --- Slide X --- markers from text."""
    if not text: return ""
    return re.sub(r"--- (Page|Slide) \d+ ---", "", text)

def answer_question(question, context):
    if not context or not question:
        return "Insufficient information to answer."

    # Strip markers
    context = strip_markers(context)
    
    # 1. Smarter Windowing: Find most relevant section based on question keywords
    # This helps even with large books
    keywords = [w.lower() for w in re.findall(r'\w+', question) if len(w) > 3]
    if not keywords:
        keywords = question.lower().split()
        
    start_pos = 0
    max_matches = 0
    # Scan text in chunks to find highest keyword density
    chunk_size = 1000
    step = 500
    for i in range(0, max(0, len(context) - chunk_size), step):
        chunk = context[i:i+chunk_size].lower()
        matches = sum(1 for k in keywords if k in chunk)
        if matches > max_matches:
            max_matches = matches
            start_pos = i
            
    # Buffer around the best match
    window_start = max(0, start_pos - 500)
    window_end = min(len(context), window_start + 2500)
    relevant_context = context[window_start:window_end]

    try:
        import torch
        qa_model, qa_tokenizer = AIModels.get_qa()
        
        inputs = qa_tokenizer(question, relevant_context, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            outputs = qa_model(**inputs)
            
        answer_start_index = outputs.start_logits.argmax()
        answer_end_index = outputs.end_logits.argmax()
        
        if answer_end_index >= answer_start_index:
            predict_answer_tokens = inputs.input_ids[0, answer_start_index : answer_end_index + 1]
            answer = qa_tokenizer.decode(predict_answer_tokens, skip_special_tokens=True).strip()
            
            if len(answer) > 0 and "definitive answer" not in answer.lower():
                return answer

        # 2. GENERATIVE FALLBACK: If extractive QA fails, use BART to reason/summarize an answer
        log_error(f"Extractive QA failed for '{question}'. Trying generative fallback...")
        gen_answer = generate_answer(question, relevant_context)
        if gen_answer:
            return gen_answer
            
        return "I couldn't find a definitive answer in the text."
    except Exception as e:
        log_error(f"QA Error: {e}")
        return f"Error processing question: {str(e)}"

def generate_answer(question, context):
    """Generates a reasoned answer using BART when extractive QA fails."""
    from utils.model_loader import AIModels
    try:
        summarizer_model, summarizer_tokenizer = AIModels.get_summarizer()
        
        # Construct a more direct prompt for concise answering
        input_text = f"Context: {context[:1200]}\n\nBased on the context, what is the short answer to: {question}?\nAnswer: "
        
        inputs = summarizer_tokenizer(input_text, max_length=1024, truncation=True, return_tensors="pt")
        output_ids = summarizer_model.generate(
            inputs["input_ids"],
            max_length=30,  # Reduced max_length for conciseness
            min_length=2,
            num_beams=4,
            early_stopping=True
        )
        answer = summarizer_tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        
        # Clean boilerplate
        if "answer:" in answer.lower():
            answer = answer.lower().split("answer:", 1)[1].strip()
        elif "based on the context," in answer.lower():
            answer = answer.lower().split("based on the context,", 1)[1].strip()
        
        if len(answer) < 5 or answer.lower() in question.lower():
            return None
            
        return answer[0].upper() + answer[1:] if answer else None
    except:
        return None

def generate_explanation(phrase, context):
    """
    Generative explanation of a phrase/word using BART (Summarizer model).
    Simplified prompt to prevent model from echoing the instructions.
    """
    from utils.model_loader import AIModels
    from utils.logger import log_error
    try:
        summarizer_model, summarizer_tokenizer = AIModels.get_summarizer()
        
        # Strip markers and prepare context
        clean_context = strip_markers(context)
        
        # Simpler prompt for BART (as it is mainly a summarizer)
        # We present it as a definition task
        input_text = f"In this book excerpt: {clean_context[:1000]}\n\nThe phrase '{phrase}' means: "
        
        inputs = summarizer_tokenizer(input_text, max_length=1024, truncation=True, return_tensors="pt")
        summary_ids = summarizer_model.generate(
            inputs["input_ids"], 
            min_length=5, 
            max_length=50, 
            num_beams=4, 
            early_stopping=True,
            no_repeat_ngram_size=3
        )
        explanation = summarizer_tokenizer.decode(summary_ids[0], skip_special_tokens=True).strip()
        
        # Robust Cleanup Loop: Strip all known prompt prefixes and echoed instructions
        # We also specifically strip the full instruction block if it leaks
        prefixes_to_strip = [
            f"in this book excerpt:", 
            f"the phrase '{phrase}' means:", 
            f"the phrase {phrase} means:",
            f"in this story, the word '{phrase}' refers to:",
            "task: explain what", 
            "explain what",
            "meaning:",
            "task:",
            "explanation:",
            "do not use page numbers or slide numbers in your answer .",
            "focus on the story and the specific situation .",
            "in this paragraph ."
        ]
        
        cleaned = explanation.lower()
        # Multi-pass stripping
        for _ in range(3):
            for prefix in prefixes_to_strip:
                if cleaned.startswith(prefix):
                    explanation = explanation[len(prefix):].strip()
                    cleaned = explanation.lower()
                elif cleaned.endswith(prefix):
                     explanation = explanation[:-len(prefix)].strip()
                     cleaned = explanation.lower()
                elif prefix in cleaned and len(cleaned) < 200:
                    # If the prompt is the WHOLE output, reject it
                    explanation = explanation.replace(prefix, "").strip()
                    cleaned = explanation.lower()
                
        # If it still starts with a colon or random punctuation after stripping
        explanation = re.sub(r"^[^\w\s]+", "", explanation).strip()

        # If it's too short or just a fragment of the prompt, it failed
        if len(explanation) < 5 or explanation.lower() in [phrase.lower(), "lazy"]:
            return None

        # Capitalize first letter
        if explanation:
            explanation = explanation[0].upper() + explanation[1:]
            
        return explanation
    except Exception as e:
        log_error(f"Generative explanation error: {str(e)}")
        return None