import sys
import os

# Add root to path
sys.path.append(os.getcwd())

from utils.dictionary import get_meaning
from utils.logger import log_error

# Monkey-patch log_error to print to console
import utils.logger
utils.logger.log_error = lambda msg: print(f"LOG: {msg}")

def test_meaning():
    try:
        word = "Bonjour"
        print(f"Testing meaning for: {word}")
        res = get_meaning(word)
        print(f"Result: {res}\n")

        # Test with a Tamil word for "Greeting"
        word_ta = "வணக்கம்"
        print(f"Testing meaning for: {word_ta}")
        res_ta = get_meaning(word_ta, target_lang='ta')
        print(f"Result: {res_ta}\n")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_meaning()
