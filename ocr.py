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
            
            if page_text:
                text += f"\n--- Page {i+1} ---\n" + page_text + "\n"
        
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
                text += pytesseract.image_to_string(img) + "\n"
            doc.close()
        except Exception as e_ocr:
            log_error(f"Emergency OCR also failed: {e_ocr}")
            text = f"Error: Could not read file content. ({e})"

    return text