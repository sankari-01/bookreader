import requests
import os

BASE_URL = "http://localhost:5000"

def test_read_book():
    print("Testing /api/read...")
    # Get the first book from the library
    resp = requests.get(f"{BASE_URL}/api/files")
    files = resp.json().get("files", [])
    if not files:
        print("No files found in library to test.")
        return
    
    filename = files[0]['filename']
    print(f"Reading book: {filename}")
    
    # Test original language
    resp = requests.get(f"{BASE_URL}/api/read/{filename}")
    data = resp.json()
    print(f"Original text length: {len(data.get('original_text', ''))}")
    print(f"Current text length: {len(data.get('text', ''))}")
    
    # Test translation (Tamil)
    resp = requests.get(f"{BASE_URL}/api/read/{filename}?lang=ta")
    data = resp.json()
    print(f"Translated to Tamil. Current text length: {len(data.get('text', ''))}")
    print(f"Original text still present: {'original_text' in data}")
    if 'original_text' in data:
        print(f"Original text length: {len(data['original_text'])}")

def test_speak_expressive_flag():
    print("\nTesting /api/speak with expressive=false...")
    payload = {
        "text": "This is a test of the non-expressive Read Aloud. It should be the original document text and nothing else.",
        "filename": "test.txt",
        "lang": "en",
        "expressive": "false"
    }
    resp = requests.post(f"{BASE_URL}/api/speak", data=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Success: {data.get('message')}")
        print(f"Audio URL: {data.get('audio_url')}")
    else:
        print(f"Failed: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    try:
        test_read_book()
        test_speak_expressive_flag()
    except Exception as e:
        print(f"Error: {e}")
