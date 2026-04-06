from uebaEngine import train_ueba, detect_user_anomaly

# Training data (normal behaviour)
training_data = [
    [0, 5, 9, 0],
    [1, 3, 10, 0],
    [0, 7, 11, 0],
    [0, 4, 12, 0],
    [2, 6, 13, 0]
]

# Train model
train_ueba(training_data)

# Suspicious activity
features = [10, 80, 3, 1]

anomaly = detect_user_anomaly(features)

if anomaly:
    print("🚨 UEBA ALERT: Suspicious user behavior")
else:
    print("✅ Normal behavior")