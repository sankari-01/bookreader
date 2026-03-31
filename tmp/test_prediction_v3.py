import requests
import json

url = "http://localhost:5000/api/predict_questions"
filename = "Fairytale-Mulan.pdf"
data = {"filename": filename, "lang": "en"}

try:
    response = requests.post(url, data=data)
    print(f"Status: {response.status_code}")
    result = response.json()
    print("Short Questions Count:", len(result.get('short_questions', [])))
    print("Long Questions Count:", len(result.get('long_questions', [])))
    # print(json.dumps(result, indent=2))
except Exception as e:
    print(f"Error: {e}")
