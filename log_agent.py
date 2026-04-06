import psutil
import requests
import time
import socket

SERVER_URL = "http://localhost:5000/api/ingest/windows"

hostname = socket.gethostname()

while True:
    log = {
        "host": hostname,
        "cpu": psutil.cpu_percent(),
        "memory": psutil.virtual_memory().percent,
        "timestamp": time.time()
    }

    try:
        requests.post(SERVER_URL, json=log)
        print("Log sent:", log)
    except Exception as e:
        print("Error:", e)

    time.sleep(2)