import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()

model = IsolationForest(
    n_estimators=100,
    contamination=0.02,
    random_state=42
)

trained = False


def train_ueba(data):
    global trained

    features = np.array(data)

    scaled = scaler.fit_transform(features)

    model.fit(scaled)

    trained = True

    print("UEBA Model Trained")


def detect_user_anomaly(user_features):

    if not trained:
        return False

    features = np.array(user_features).reshape(1, -1)

    scaled = scaler.transform(features)

    prediction = model.predict(scaled)

    return prediction[0] == -1