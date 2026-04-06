import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# =========================
# GLOBAL OBJECTS
# =========================

scaler = StandardScaler()

iso_forest = IsolationForest(
    n_estimators=100,
    contamination=0.02,
    random_state=42
)

lof = LocalOutlierFactor(
    n_neighbors=20,
    contamination=0.02,
    novelty=True
)

kmeans = KMeans(
    n_clusters=3,
    random_state=42
)

# =========================
# TRAINING STATE
# =========================

model_trained = False
training_buffer = []

# Number of logs required before training
BUFFER_SIZE = 100

# Maximum samples kept for training history
MAX_HISTORY = 1000

training_history = []

# =========================
# TRAIN MODEL
# =========================

def train_model(data):

    global model_trained

    if len(data) < 10:
        return {
            "status": "waiting_for_more_data"
        }

    data = np.array(data)

    scaled = scaler.fit_transform(data)

    iso_forest.fit(scaled)
    lof.fit(scaled)
    kmeans.fit(scaled)

    model_trained = True

    print("✅ ML Model trained with", len(data), "samples")

    return {
        "status": "success",
        "samples": len(data)
    }

# =========================
# AUTO TRAINING
# =========================

def auto_train(features):

    global training_buffer
    global training_history

    training_buffer.append(features)
    training_history.append(features)

    # keep history size limited
    if len(training_history) > MAX_HISTORY:
        training_history = training_history[-MAX_HISTORY:]

    # train when buffer fills
    if len(training_buffer) >= BUFFER_SIZE:

        print("⚡ Auto training ML model...")

        train_model(training_history)

        training_buffer = []

# =========================
# DETECT ANOMALY
# =========================

def detect_anomaly(features):

    global model_trained

    # collect data for training
    auto_train(features)

    # if model not ready yet
    if not model_trained:
        return {
            "status": "collecting_training_data",
            "anomaly": False
        }

    features = np.array(features).reshape(1, -1)

    scaled = scaler.transform(features)

    # ----------------------
    # Isolation Forest
    # ----------------------

    iso_result = iso_forest.predict(scaled)[0]

    # ----------------------
    # LOF
    # ----------------------

    lof_result = lof.predict(scaled)[0]

    # ----------------------
    # KMeans distance
    # ----------------------

    cluster = kmeans.predict(scaled)
    center = kmeans.cluster_centers_[cluster]

    distance = np.linalg.norm(scaled - center)

    # ----------------------
    # Voting system
    # ----------------------

    anomaly_votes = 0

    if iso_result == -1:
        anomaly_votes += 1

    if lof_result == -1:
        anomaly_votes += 1

    if distance > 2:
        anomaly_votes += 1

    is_anomaly = anomaly_votes >= 2

    return {
        "status": "success",
        "anomaly": bool(is_anomaly),
        "votes": anomaly_votes,
        "distance": float(distance)
    }