import mammoth
import os

path = 'd:/AI_Book_Reader/uploads/fswd ex 09.docx'
if os.path.exists(path):
    with open(path, 'rb') as f:
        result = mammoth.convert_to_html(f)
        print(f"HTML Length: {len(result.value)}")
        print(f"HTML Preview: {result.value[:200]}...")
else:
    print("File not found.")
