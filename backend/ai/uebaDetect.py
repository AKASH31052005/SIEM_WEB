import sys
import json
from uebaEngine import detect_user_anomaly, train_ueba

# training data (temporary)
training_data = [
    [0,5,9,0],
    [1,3,10,0],
    [0,7,11,0],
    [0,4,12,0],
    [2,6,13,0]
]

train_ueba(training_data)

features = json.loads(sys.argv[1])

anomaly = detect_user_anomaly(features)

if anomaly:
    print("ANOMALY")
else:
    print("NORMAL")