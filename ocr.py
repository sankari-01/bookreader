import pytesseract
import fitz  # PyMuPDF
import PyPDF2
import os
import io
from PIL import Image
from utils.logger import log_error

# Configure Tesseract path for Windows
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_text(path):
    """
    Extracts text from a PDF file. 
    Attempts standard text extraction first; if failed or text is sparse, 
    falls back to OCR (Optical Character Recognition).
    """
    text = ""
    
    if not path.endswith(".pdf"):
        return ""

    if not os.path.exists(path):
        return "Error: File not found."

    try:
        # 1. Open with PyMuPDF for potential OCR on individual pages
        doc = fitz.open(path)
        reader = PyPDF2.PdfReader(path)
        
        for i in range(len(doc)):
            page_obj = reader.pages[i]
            page_text = page_obj.extract_text()
            
            if not page_text or len(page_text.strip()) < 10:
                # Page seems empty or is an image — run OCR on this specific page
                log_error(f"Page {i+1} appears empty or image-based. Running OCR fallback...")
                page_fitz = doc.load_page(i)
                pix = page_fitz.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                page_text = pytesseract.image_to_string(img)
            
            # Always add marker to maintain page alignment
            text += f"\n--- Page {i+1} ---\n"
            if page_text:
                text += page_text + "\n"
            else:
                text += "[Empty Page]\n"
        
        doc.close()
        log_error(f"Extraction completed for: {path}")

    except Exception as e:
        log_error(f"Error extracting text from PDF {path}: {e}")
        # Final fallback - try OCR using fitz even if PyPDF2 crashed
        try:
            log_error(f"Attempting emergency OCR for: {path}")
            doc = fitz.open(path)
            text = ""
            for page_index in range(len(doc)):
                page = doc.load_page(page_index)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                text += f"\n--- Page {page_index+1} ---\n"
                page_text = pytesseract.image_to_string(img)
                text += (page_text if page_text else "[Empty Page]") + "\n"
            doc.close()
        except Exception as e_ocr:
            log_error(f"Emergency OCR also failed: {e_ocr}")
            text = f"Error: Could not read file content. ({e})"

    return text

def count_images(path):
    """Returns True if the PDF contains any images."""
    if not path.endswith(".pdf"):
        return False
    try:
        doc = fitz.open(path)
        has_images = False
        for page in doc:
            if len(page.get_images()) > 0:
                has_images = True
                break
        doc.close()
        return has_images
    except:
        return False

def extract_images_from_pdf(path, output_dir):
    """Extracts images from PDF and returns a list of (image_url, ocr_explanation)."""
    results = []
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    try:
        doc = fitz.open(path)
        img_count = 0
        
        for i in range(len(doc)):
            page = doc.load_page(i)
            image_list = page.get_images(full=True)
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]
                
                # Use a specific filename per book
                safe_name = "".join([c if c.isalnum() else "_" for c in os.path.basename(path)])
                img_filename = f"img_{safe_name}_{i+1}_{img_index}.{ext}"
                img_path = os.path.join(output_dir, img_filename)
                
                if not os.path.exists(img_path):
                    with open(img_path, "wb") as f:
                        f.write(image_bytes)
                
                # Perform OCR/AI Explanation
                try:
                    pil_img = Image.open(io.BytesIO(image_bytes))
                    
                    # Try Gemini AI first for 40-word explanation
                    from utils.gemini_assistant import GeminiAssistant
                    ai_prompt = (
                        "You are an expert visual analyst. Describe this image in exactly 40 words. "
                        "Do not just list objects; instead, explain the *context*, *purpose*, and *significance* "
                        "of this visual within a professional document. Focus on what it communicates to the reader."
                    )
                    explanation = GeminiAssistant.describe_image(pil_img, ai_prompt)
                    
                    # Robust check for any AI error format (case-insensitive)
                    failed_ai = not explanation or "error" in explanation.lower() or "configuration" in explanation.lower() or "empty" in explanation.lower()
                    
                    if failed_ai:
                        # Fallback to local Free AI Explainer (OCR + Pattern-based)
                        ocr_text = pytesseract.image_to_string(pil_img).strip()
                        from utils.free_ai import FreeImageExplainer
                        explanation = FreeImageExplainer.explain(ocr_text)
                        
                except Exception as e:
                    explanation = f"Free explanatory analysis could not be performed for this image. ({str(e)})"
                
                results.append({
                    "url": f"/static/extracted_images/{img_filename}",
                    "explanation": explanation,
                    "page": i + 1
                })
                img_count += 1
                if img_count >= 25: break # Cap for performance
            if img_count >= 25: break
            
        doc.close()
    except Exception as e:
        log_error(f"Image extraction error: {e}")
        
    return results