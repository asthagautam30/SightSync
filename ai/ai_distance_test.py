import cv2
import time
import requests
from ultralytics import YOLO

# -----------------------------
# YOLO
# -----------------------------
model = YOLO("yolo11n.pt")

relevant_objects = ["book", "laptop", "cell phone"]

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
# Settings
# -----------------------------
VIEW_DISTANCE_LIMIT = 100       # cm
VIEW_TIME_LIMIT = 40            # seconds
TOTAL_WINDOW = 60               # seconds

# -----------------------------
# Camera
# -----------------------------
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera not working")
    exit()

# -----------------------------
# Variables
# -----------------------------
viewing_time = 0

window_start = time.time()
last_time = time.time()

user_active = True

firebase_distance = None
last_firebase_read = 0

# AI Firebase update timer
last_ai_update = 0

print("AI Distance Test Started")
print("A = Active")
print("S = Inactive")
print("Q = Quit")

# -----------------------------
# Function: Update AI data
# -----------------------------
def update_ai_data(
    object_name,
    object_detected,
    viewing,
    viewing_time,
    warning
):

    ai_data = {
        "object": object_name if object_name else "none",
        "objectDetected": object_detected,
        "viewing": viewing,
        "viewingTime": round(viewing_time, 1),
        "warning": warning
    }

    try:

        response = requests.patch(
            FIREBASE_AI_URL,
            json=ai_data,
            timeout=3
        )

        if response.status_code != 200:
            print(
                "AI Firebase error:",
                response.status_code,
                response.text
            )

    except Exception as e:

        print("AI Firebase error:", e)


# -----------------------------
# Main loop
# -----------------------------
while True:

    ret, frame = cap.read()

    if not ret:
        print("Camera frame not received")
        break

    current_time = time.time()

    # --------------------------------
    # Read distance from Firebase
    # --------------------------------
    if current_time - last_firebase_read >= 1:

        try:

            response = requests.get(
                FIREBASE_URL,
                timeout=3
            )

            if response.status_code == 200:

                data = response.json()

                if data and "distance" in data:

                    firebase_distance = float(
                        data["distance"]
                    )

        except Exception as e:

            print("Firebase error:", e)

        last_firebase_read = current_time

    # --------------------------------
    # YOLO detection
    # --------------------------------
    results = model(
        frame,
        verbose=False
    )

    detected_object = None

    for result in results:

        for box in result.boxes:

            class_id = int(box.cls[0])

            class_name = model.names[class_id]

            if class_name in relevant_objects:

                detected_object = class_name

    # --------------------------------
    # Calculate time difference
    # --------------------------------
    dt = current_time - last_time

    last_time = current_time

    # --------------------------------
    # Viewing condition
    # --------------------------------
    viewing = False

    if detected_object is not None:

        if firebase_distance is not None:

            if firebase_distance <= VIEW_DISTANCE_LIMIT:

                if user_active:

                    viewing = True

                    viewing_time += dt

    # --------------------------------
    # Status
    # --------------------------------
    if detected_object is None:

        status = "NO RELEVANT OBJECT"

    elif firebase_distance is None:

        status = "WAITING FOR DISTANCE"

    elif firebase_distance > VIEW_DISTANCE_LIMIT:

        status = "OBJECT TOO FAR"

    elif not user_active:

        status = "USER INACTIVE"

    else:

        status = "VIEWING"

    # --------------------------------
    # Warning
    # --------------------------------
    warning = viewing_time >= VIEW_TIME_LIMIT

    # --------------------------------
    # Send AI data to Firebase
    # Every 1 second
    # --------------------------------
    if current_time - last_ai_update >= 1:

        update_ai_data(
            detected_object,
            detected_object is not None,
            viewing,
            viewing_time,
            warning
        )

        last_ai_update = current_time

    # --------------------------------
    # Display Object
    # --------------------------------
    cv2.putText(
        frame,
        f"Object: {detected_object}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 0),
        2
    )

    # --------------------------------
    # Display Distance
    # --------------------------------
    cv2.putText(
        frame,
        f"Distance: {firebase_distance if firebase_distance is not None else 'N/A'} cm",
        (20, 70),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 0),
        2
    )

    # --------------------------------
    # Display Status
    # --------------------------------
    cv2.putText(
        frame,
        f"Status: {status}",
        (20, 105),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 0, 255) if warning else (0, 255, 0),
        2
    )

    # --------------------------------
    # Display Viewing Time
    # --------------------------------
    cv2.putText(
        frame,
        f"Viewing Time: {int(viewing_time)} sec",
        (20, 140),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    # --------------------------------
    # Display Limit
    # --------------------------------
    cv2.putText(
        frame,
        f"Limit: {VIEW_TIME_LIMIT} sec",
        (20, 175),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    # --------------------------------
    # Warning Message
    # --------------------------------
    if warning:

        cv2.putText(
            frame,
            "WARNING: VIEWING TIME LIMIT EXCEEDED!",
            (20, 215),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2
        )

    # --------------------------------
    # Show Camera
    # --------------------------------
    cv2.imshow(
        "Smart Spectacles - AI Distance",
        frame
    )

    # --------------------------------
    # Keyboard controls
    # --------------------------------
    key = cv2.waitKey(1) & 0xFF

    if key == ord('a'):

        user_active = True

        print("User ACTIVE")

    elif key == ord('s'):

        user_active = False

        print("User INACTIVE")

    elif key == ord('q'):

        break

    # --------------------------------
    # Reset after 1 minute
    # --------------------------------
    if current_time - window_start >= TOTAL_WINDOW:

        viewing_time = 0

        window_start = current_time

        print("1 minute window reset")


# -----------------------------
# Cleanup
# -----------------------------
cap.release()
cv2.destroyAllWindows()