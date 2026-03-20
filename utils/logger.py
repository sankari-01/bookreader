import os
from datetime import datetime

LOG_FILE = "error_log.txt"

def log_error(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: {msg}\n")
