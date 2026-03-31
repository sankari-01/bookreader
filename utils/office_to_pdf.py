import os
import multiprocessing
from utils.logger import log_error

def _convert_word_worker(input_path, output_path):
    # Initialize COM only inside the child process
    import comtypes.client
    import comtypes
    comtypes.CoInitialize()
    word = None
    try:
        word = comtypes.client.CreateObject('Word.Application', dynamic=True)
        word.Visible = False
        # Using positional arguments: Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, ...)
        doc = word.Documents.Open(input_path, False, True, False)
        # Using positional arguments for SaveAs(FileName, FileFormat, ...)
        # 17 represents wdFormatPDF
        doc.SaveAs(output_path, 17)
        doc.Close(0) # 0 = wdDoNotSaveChanges
        word.Quit()
        word = None
    except Exception as e:
        log_error(f"Worker Word conversion error: {str(e)}")
        if word:
            try: word.Quit()
            except: pass
        raise
    finally:
        comtypes.CoUninitialize()

def _convert_ppt_worker(input_path, output_path):
    import comtypes.client
    import comtypes
    comtypes.CoInitialize()
    powerpoint = None
    try:
        powerpoint = comtypes.client.CreateObject('Powerpoint.Application', dynamic=True)
        # Open(FileName, ReadOnly, Untitled, WithWindow)
        slides = powerpoint.Presentations.Open(input_path, WithWindow=False)
        # 32 represents ppSaveAsPDF
        slides.SaveAs(output_path, 32)
        slides.Close()
        powerpoint.Quit()
        powerpoint = None
    except Exception as e:
        log_error(f"Worker PPT conversion error: {str(e)}")
        if powerpoint:
            try: powerpoint.Quit()
            except: pass
        raise
    finally:
        comtypes.CoUninitialize()

def convert_to_pdf(input_path, timeout=30):
    """
    Converts a DOCX or PPTX file to PDF using Microsoft Office COM with a hard timeout.
    Returns the path to the converted PDF or None if failed.
    """
    input_path = os.path.abspath(input_path)
    base, ext = os.path.splitext(input_path)
    output_path = base + '.pdf'
    
    if os.path.exists(output_path):
        return output_path
        
    ext = ext.lower()
    target = None
    if ext in ['.doc', '.docx']:
        target = _convert_word_worker
    elif ext in ['.ppt', '.pptx']:
        target = _convert_ppt_worker
    else:
        return None

    try:
        # We MUST use a separate process because COM calls can be blocking and non-interruptible
        p = multiprocessing.Process(target=target, args=(input_path, output_path))
        p.start()
        p.join(timeout)
        
        if p.is_alive():
            log_error(f"Office conversion TIMEOUT ({timeout}s) for {input_path}. Terminating.")
            p.terminate()
            p.join()
            return None
            
        if os.path.exists(output_path):
            return output_path
            
    except Exception as e:
        log_error(f"Process-based conversion failed for {input_path}: {e}")
        
    return None
