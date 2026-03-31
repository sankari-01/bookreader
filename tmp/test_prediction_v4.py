import requests
import json

url = "http://localhost:5000/api/predict_questions"
filename = "Fairytale-Mulan.pdf"
data = {"filename": filename, "lang": "en"}

try:
    response = requests.post(url, data=data)
    print(f"Status: {response.status_code}")
    result = response.json()
    
    print("\n--- Short Question 1 Answer ---")
    sq1_ans = result.get('short_questions', [{}])[0].get('answer', '')
    print(sq1_ans)
    print(f"Line count: {len(sq1_ans.splitlines())}")

    print("\n--- Long Question 1 Answer ---")
    lq1_ans = result.get('long_questions', [{}])[0].get('answer', '')
    print(lq1_ans)
    print(f"Line count: {len(lq1_ans.splitlines())}")
except Exception as e:
    print(f"Error: {e}")
