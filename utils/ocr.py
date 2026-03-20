import pytesseract
from pdf2image import convert_from_path
import PyPDF2

def extract_text(path):

    text = ""

    if path.endswith(".pdf"):

        reader = PyPDF2.PdfReader(path)

        for page in reader.pages:
            if page.extract_text():
                text += page.extract_text()

    return text