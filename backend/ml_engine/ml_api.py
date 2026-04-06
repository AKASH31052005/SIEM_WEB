from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from anomaly_detection import train_model, detect_anomaly

app = FastAPI(
    title="SIEM AI Engine",
    description="Machine Learning based anomaly detection for SIEM",
    version="1.0"
)


# =========================
# DATA MODELS
# =========================

class TrainData(BaseModel):
    data: list


class FeatureData(BaseModel):
    features: list


# =========================
# HEALTH CHECK
# =========================

@app.get("/")
def home():
    return {
        "service": "SIEM ML Engine",
        "status": "running"
    }


# =========================
# TRAIN MODEL
# =========================

@app.post("/train")
def train(data: TrainData):

    result = train_model(data.data)

    return result


# =========================
# DETECT ANOMALY
# =========================

@app.post("/detect")
def detect(data: FeatureData):

    result = detect_anomaly(data.features)

    return result


# =========================
# RUN SERVER DIRECTLY
# =========================

if __name__ == "__main__":
    uvicorn.run(
        "ml_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )