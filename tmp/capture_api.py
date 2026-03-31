import requests
import json

try:
    r = requests.get('http://localhost:5000/api/read/fswd%20ex%2009.docx')
    if r.status_code == 200:
        d = r.json()
        # Remove large fields for brevity
        for key in ['text', 'original_text', 'office_html']:
            if key in d:
                print(f"Field {key} present with length: {len(d[key])}")
                del d[key]
        print(json.dumps(d, indent=2))
    else:
        print(f"Error: {r.status_code}")
        print(r.text)
except Exception as e:
    print(f"Exception: {e}")
