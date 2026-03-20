import asyncio
import edge_tts
import os

async def test_tamil():
    text = "வணக்கம், இது ஒரு சோதனை."
    voice = "ta-IN-PallaviNeural"
    output_file = "test_tamil.mp3"
    
    # This is what build_ssml would generate for non-expressive voices
    ssml = f'''<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ta-IN">
    <voice name="{voice}">
        <prosody rate="-5%" pitch="+0Hz">{text}</prosody>
    </voice>
    </speak>'''
    
    print(f"Testing Tamil SSML: {ssml}")
    
    try:
        communicate = edge_tts.Communicate(ssml, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                with open(output_file, "ab") as f:
                    f.write(chunk["data"])
        print("Success! Tamil audio generated.")
        if os.path.exists(output_file):
            print(f"File size: {os.path.getsize(output_file)} bytes")
            # os.remove(output_file)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_tamil())
