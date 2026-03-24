import sys
import json
import random

def detect_anomaly(user_data):
    # Simulated ML anomaly detection (Isolation Forest or Autoencoder based)
    # Checks if the user's current behavior deviates from their baseline.
    try:
        # For simulation, 5% false positive rate target means we should only flag rarely.
        score = random.random()
        is_anomaly = score > 0.95
        
        return {
            "isAnomaly": is_anomaly,
            "confidence": score,
            "details": {
                "deviationScore": score,
                "factors": ["Login Time Anomaly", "Location Anomaly"] if is_anomaly else []
            }
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    input_data = sys.stdin.read()
    if input_data:
        try:
            parsed_data = json.loads(input_data)
            result = detect_anomaly(parsed_data)
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}))
    else:
        print(json.dumps({"error": "No input provided"}))
