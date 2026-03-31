import time
import requests

def test_docx_speed():
    # Use a dummy filename that doesn't have a PDF yet
    # Since I don't know the files, I'll just check if there's any docx in uploads
    import os
    docx_files = [f for f in os.listdir("uploads") if f.endswith(".docx") and not os.path.exists(os.path.join("uploads", os.path.splitext(f)[0] + ".pdf"))]
    
    if not docx_files:
        print("No fresh .docx files found to test.")
        return
        
    filename = docx_files[0]
    print(f"Testing speed for: {filename}")
    
    start = time.time()
    try:
        r = requests.get(f"http://localhost:5000/api/read/{filename}", timeout=60)
        end = time.time()
        print(f"Status Code: {r.status_code}")
        print(f"Elapsed Time: {end - start:.2f} seconds")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_docx_speed()
