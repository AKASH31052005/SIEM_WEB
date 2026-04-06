import sys
import json
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()

def detect_network_anomaly(data):

    X = np.array(data).reshape(1, -1)

    X_scaled = scaler.fit_transform(X)

    model = DBSCAN(eps=0.5, min_samples=1)

    clusters = model.fit_predict(X_scaled)

    if clusters[0] == -1:
        return True
    return False


features = json.loads(sys.argv[1])

anomaly = detect_network_anomaly(features)

if anomaly:
    print("NETWORK_ANOMALY")
else:
    print("NORMAL")