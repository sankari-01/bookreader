import os
import comtypes.client
from utils.logger import log_error

def _convert_word(input_path, output_path):
    word = comtypes.client.CreateObject('Word.Application')
    # Background execution
    word.Visible = False
    try:
        doc = word.Documents.Open(input_path)
        # 17 represents wdFormatPDF
        doc.SaveAs(output_path, FileFormat=17)
        doc.Close()
    finally:
        word.Quit()

def _convert_ppt(input_path, output_path):
    powerpoint = comtypes.client.CreateObject('Powerpoint.Application')
    # PowerPoint requires Visible=1 (True) or WithWindow=msoFalse depending on version,
    # but generally setting it to WithWindow=False in Open helps.
    try:
        # Open(FileName, ReadOnly, Untitled, WithWindow)
        slides = powerpoint.Presentations.Open(input_path, WithWindow=False)
        # 32 represents ppSaveAsPDF
        slides.SaveAs(output_path, 32)
        slides.Close()
    finally:
        powerpoint.Quit()

def convert_to_pdf(input_path):
    """
    Converts a DOCX or PPTX file to PDF using Microsoft Office COM.
    Returns the path to the converted PDF or None if failed.
    """
    input_path = os.path.abspath(input_path)
    base, ext = os.path.splitext(input_path)
    output_path = base + '.pdf'
    
    if os.path.exists(output_path):
        return output_path
        
    ext = ext.lower()
    
    try:
        # Initialize COM
        comtypes.CoInitialize()
        
        if ext in ['.doc', '.docx']:
            _convert_word(input_path, output_path)
        elif ext in ['.ppt', '.pptx']:
            _convert_ppt(input_path, output_path)
        else:
            return None
            
        comtypes.CoUninitialize()
        return output_path
        
    except Exception as e:
        log_error(f"Failed to convert {input_path} to PDF via Office COM: {str(e)}")
        # Make sure to uninitialize
        try:
            comtypes.CoUninitialize()
        except:
            pass
        return None
