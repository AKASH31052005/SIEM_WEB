import sys
import json

# load threat database
with open("./ai/threatIntel.json") as f:
    threat_db = json.load(f)

data = json.loads(sys.argv[1])

ip = data.get("ip")
domain = data.get("domain")

if ip in threat_db["malicious_ips"]:
    print("MALICIOUS_IP")

elif domain in threat_db["malicious_domains"]:
    print("MALICIOUS_DOMAIN")

else:
    print("SAFE")