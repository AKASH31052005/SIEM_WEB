import sys
import json
import requests

API_KEY = "11d6ada34b2aa17188248743ac7c4605597baeee0ae7cae0e0f7c3c2dd3301927eed34dbc9f1d652"


def extract_ip(arg):
    """
    Supports both:
    1) JSON input from Node.js
    2) Direct IP input from terminal
    """

    try:
        data = json.loads(arg)

        if isinstance(data, dict):
            return (
                data.get("ip")
                or data.get("source_ip")
                or data.get("client_ip")
                or data.get("src_ip")
            )

    except:
        # If JSON parsing fails, treat argument as IP
        return arg

    return None


def check_ip(ip):

    if not ip:
        print("SAFE")
        return

    url = "https://api.abuseipdb.com/api/v2/check"

    headers = {
        "Key": API_KEY,
        "Accept": "application/json"
    }

    params = {
        "ipAddress": ip,
        "maxAgeInDays": 90
    }

    try:

        response = requests.get(url, headers=headers, params=params, timeout=5)

        result = response.json()

        score = result.get("data", {}).get("abuseConfidenceScore", 0)
        print("Score:", score)

        if score >= 75:
            print("MALICIOUS_IP")
        else:
            print("SAFE")

    except Exception as e:
        print("SAFE")


if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("SAFE")
        sys.exit()

    ip = extract_ip(sys.argv[1])

    check_ip(ip)