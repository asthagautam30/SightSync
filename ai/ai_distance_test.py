import time
from pathlib import Path

import cv2
import requests
from ultralytics import YOLO

# -----------------------------
# Paths and YOLO
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "yolo11n.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found at: {MODEL_PATH}\n"
        "Make sure yolo11n.pt is inside the ai folder."
    )

model = YOLO(str(MODEL_PATH))
relevant_objects = {"book", "laptop", "cell phone"}

# -----------------------------
# Firebase
# -----------------------------
FIREBASE_URL = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/current.json"
)
FIREBASE_AI_URL = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/current/ai.json"
)

# -----------------------------
# Visual Comfort Settings
# -----------------------------
VIEW_DISTANCE_LIMIT = 100       # cm
VIEW_TIME_LIMIT = 40            # seconds within a 60-second window
CLOSE_DISTANCE_LIMIT = 25       # cm
CLOSE_VIEW_TIME_LIMIT = 20      # seconds within a 60-second window
TOTAL_WINDOW = 60                # seconds

# -----------------------------
# Camera
# -----------------------------
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Camera not working. Check that your webcam is available.")
    raise SystemExit(1)

# -----------------------------
# Variables
# -----------------------------
viewing_time = 0.0
close_viewing_time = 0.0
window_start = time.monotonic()
last_time = time.monotonic()
last_firebase_read = 0.0
last_ai_update = 0.0
user_active = True
firebase_distance = None

# Reuse one session for Firebase requests.
session = requests.Session()


def update_ai_data(object_name, object_detected, viewing, seconds_viewed, warning):
    """Update only the AI child object, preserving other current sensor data."""
    ai_data = {
        "object": object_name or "none",
        "objectDetected": bool(object_detected),
        "viewing": bool(viewing),
        "viewingTime": round(seconds_viewed, 1),
        "warning": bool(warning),
    }

    try:
        response = session.patch(FIREBASE_AI_URL, json=ai_data, timeout=3)
        response.raise_for_status()
    except requests.RequestException as exc:
        print("AI Firebase update error:", exc)


def read_firebase_distance():
    """Read the Wokwi/ESP32 distance value; return None if unavailable."""
    try:
        response = session.get(FIREBASE_URL, timeout=3)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict) and data.get("distance") is not None:
            return float(data["distance"])
    except (requests.RequestException, TypeError, ValueError) as exc:
        print("Firebase distance read error:", exc)
    return None


print("Smart Spectacles - Visual Comfort AI Started")
print("A = Active | S = Inactive | Q = Quit")
print("Visual Comfort rules: <=100 cm for 40 sec OR <=25 cm for 20 sec")

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Camera frame not received.")
            break

        current_time = time.monotonic()

        # Read the latest distance from Firebase about once per second.
        if current_time - last_firebase_read >= 1:
            new_distance = read_firebase_distance()
            if new_distance is not None:
                firebase_distance = new_distance
            last_firebase_read = current_time

        # Detect a relevant object in the camera frame.
        results = model(frame, verbose=False)
        detected_object = None
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                if class_name in relevant_objects:
                    detected_object = class_name
                    break
            if detected_object is not None:
                break

        # Cap dt so a slow frame or brief pause does not add a large time jump.
        dt = min(max(current_time - last_time, 0.0), 1.0)
        last_time = current_time

        viewing = bool(
            detected_object is not None
            and firebase_distance is not None
            and firebase_distance <= VIEW_DISTANCE_LIMIT
            and user_active
        )

        if viewing:
            viewing_time += dt
            if firebase_distance <= CLOSE_DISTANCE_LIMIT:
                close_viewing_time += dt

        # Both conditions trigger the same Visual Comfort warning.
        duration_warning = viewing_time >= VIEW_TIME_LIMIT
        close_warning = close_viewing_time >= CLOSE_VIEW_TIME_LIMIT
        warning = duration_warning or close_warning

        if not user_active:
            status = "USER INACTIVE"
        elif detected_object is None:
            status = "NO RELEVANT OBJECT"
        elif firebase_distance is None:
            status = "WAITING FOR DISTANCE"
        elif firebase_distance > VIEW_DISTANCE_LIMIT:
            status = "OBJECT TOO FAR"
        elif warning:
            status = "VISUAL COMFORT WARNING"
        else:
            status = "VISUAL COMFORT NORMAL"

        # Send AI data every second. PATCH preserves UV/gas/light/distance fields.
        if current_time - last_ai_update >= 1:
            update_ai_data(
                detected_object,
                detected_object is not None,
                viewing,
                viewing_time,
                warning,
            )
            last_ai_update = current_time

        # On-screen information.
        cv2.putText(
            frame, f"Object: {detected_object or 'None'}", (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
        )
        distance_text = f"{firebase_distance:.1f} cm" if firebase_distance is not None else "N/A"
        cv2.putText(
            frame, f"Distance: {distance_text}", (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2,
        )
        cv2.putText(
            frame, f"Viewing Time: {int(viewing_time)} / {VIEW_TIME_LIMIT} sec", (20, 105),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2,
        )
        cv2.putText(
            frame, f"Close Time: {int(close_viewing_time)} / {CLOSE_VIEW_TIME_LIMIT} sec", (20, 140),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2,
        )
        status_color = (0, 0, 255) if warning else (0, 255, 0)
        cv2.putText(
            frame, status, (20, 180), cv2.FONT_HERSHEY_SIMPLEX,
            0.65, status_color, 2,
        )

        if warning:
            message = (
                "VISUAL COMFORT: OBJECT TOO CLOSE"
                if close_warning
                else "VISUAL COMFORT: VIEWING TIME EXCEEDED"
            )
            cv2.putText(
                frame, message, (20, 220), cv2.FONT_HERSHEY_SIMPLEX,
                0.55, (0, 0, 255), 2,
            )

        cv2.imshow("Smart Spectacles - Visual Comfort", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("a"):
            user_active = True
            print("User ACTIVE")
        elif key == ord("s"):
            user_active = False
            print("User INACTIVE")
        elif key == ord("q"):
            break

        # Reset both counters at the end of each 60-second window.
        if current_time - window_start >= TOTAL_WINDOW:
            viewing_time = 0.0
            close_viewing_time = 0.0
            window_start = current_time
            print("One-minute viewing window reset")

finally:
    cap.release()
    cv2.destroyAllWindows()
    session.close()
