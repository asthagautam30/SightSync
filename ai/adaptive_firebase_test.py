"""
Smart Spectacles: Firebase adaptive-threshold runner.

Reads /current, writes display results to /adaptive, and persists the
learner's internal state separately under /adaptive_state.
"""
import json
import time
import urllib.error
import urllib.request

from adaptive_thresholds import create_engines
from adaptive_state import export_engine_state, restore_engine_state

FIREBASE_BASE = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/"
)
FIREBASE_URL = FIREBASE_BASE + "current.json"
FIREBASE_ADAPTIVE_URL = FIREBASE_BASE + "adaptive.json"
FIREBASE_STATE_URL = FIREBASE_BASE + "adaptive_state.json"

POLL_SECONDS = 5
SENSOR_KEYS = ("uv", "gas", "light", "distance")
STATE_VERSION = 1

# Project/simulator defaults, not calibrated real-world safety limits.
FIXED_THRESHOLDS = {"uv": 3000, "gas": 2000, "light": 800, "distance": 30}


def is_fixed_warning(sensor, reading):
    threshold = FIXED_THRESHOLDS[sensor]
    return reading > threshold if sensor in ("uv", "gas") else reading < threshold


def conservative_threshold(sensor, fixed_threshold, adaptive_threshold):
    """Adaptation can add sensitivity but never relax fixed limits."""
    if sensor in ("uv", "gas"):
        return min(fixed_threshold, adaptive_threshold)
    return max(fixed_threshold, adaptive_threshold)


def firebase_get(url):
    request = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def firebase_put(url, value, label):
    payload = json.dumps(value, allow_nan=False).encode("utf-8")
    request = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        print(f"{label} saved (HTTP {response.status}).")


def restore_saved_state(engines):
    """Restore validated learner states; invalid/missing records start fresh."""
    try:
        saved = firebase_get(FIREBASE_STATE_URL)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"Saved learning state unavailable; starting fresh ({error}).")
        return

    if not isinstance(saved, dict) or saved.get("version") != STATE_VERSION:
        print("No compatible saved learning state; starting fresh.")
        return

    states = saved.get("sensors", {})
    restored = []
    for sensor, engine in engines.items():
        if isinstance(states, dict) and restore_engine_state(engine, states.get(sensor)):
            restored.append(sensor)
        else:
            print(f"  {sensor}: no valid saved state; starting fresh.")
    if restored:
        print("Restored saved learning state for: " + ", ".join(restored))


def save_learning_state(engines):
    payload = {
        "version": STATE_VERSION,
        "updatedAt": int(time.time() * 1000),
        "sensors": {
            sensor: export_engine_state(engine)
            for sensor, engine in engines.items()
        },
    }
    firebase_put(FIREBASE_STATE_URL, payload, "Persistent learning state")


def main():
    engines = create_engines()
    restore_saved_state(engines)

    print("Smart Spectacles - Adaptive Threshold Test")
    print("Sensor readings: read from Firebase /current")
    print("Dashboard results: written to Firebase /adaptive")
    print("Persistent learner state: written to Firebase /adaptive_state")
    print("Initial baseline: 60 valid readings; new-normal check: 3 batches of 20.")
    print("Press Ctrl+C to stop.")
    print("-" * 55)

    while True:
        try:
            data = firebase_get(FIREBASE_URL)
            if not isinstance(data, dict):
                print("No sensor record found, or response is not an object.")
                time.sleep(POLL_SECONDS)
                continue

            print(f"\nLatest Firebase readings ({time.strftime('%H:%M:%S')}):")
            latest_results = {}

            for sensor in SENSOR_KEYS:
                reading = data.get(sensor)
                if not isinstance(reading, (int, float)) or isinstance(reading, bool):
                    print(f"  {sensor}: no valid numeric reading")
                    continue

                reading_value = float(reading)
                engine = engines[sensor]
                fixed_threshold = FIXED_THRESHOLDS[sensor]
                fixed_warning = is_fixed_warning(sensor, reading_value)
                adaptive_warning = engine.is_warning(reading_value)

                # Never learn from a reading that trips fixed or current adaptive warning.
                result = engine.observe(
                    reading_value,
                    hazardous=(fixed_warning or adaptive_warning),
                )
                if result["baselineEstablished"]:
                    effective_threshold = conservative_threshold(
                        sensor, fixed_threshold, result["adaptiveThreshold"]
                    )
                else:
                    effective_threshold = fixed_threshold

                combined_warning = fixed_warning or (
                    reading_value > effective_threshold
                    if sensor in ("uv", "gas")
                    else reading_value < effective_threshold
                )
                latest_results[sensor] = {
                    **result,
                    "reading": reading,
                    "fixedThreshold": fixed_threshold,
                    "fixedWarning": fixed_warning,
                    "adaptiveWarning": adaptive_warning if result["baselineEstablished"] else False,
                    "adaptiveReady": result["baselineEstablished"],
                    "effectiveThreshold": round(effective_threshold, 3),
                    "warning": bool(combined_warning),
                    "validatedForRealWorldUse": False,
                }
                print(
                    f"  {sensor}: reading={reading_value}, fixed={fixed_threshold}, "
                    f"adaptive={result['adaptiveThreshold']}, effective={effective_threshold}, "
                    f"warning={combined_warning}, samples={result['initialSamplesCollected']}/"
                    f"{result['initialSamplesRequired']}, status={result['learningStatus']}"
                )

            if latest_results:
                firebase_put(
                    FIREBASE_ADAPTIVE_URL,
                    {"sensors": latest_results, "updatedAt": int(time.time() * 1000)},
                    "Adaptive results",
                )
                save_learning_state(engines)
            else:
                print("No valid sensor readings; nothing was saved.")

            time.sleep(POLL_SECONDS)

        except KeyboardInterrupt:
            print("\nTest stopped. Saved state remains in Firebase.")
            break
        except urllib.error.HTTPError as error:
            print(f"Firebase HTTP error: {error.code} {error.reason}")
            print("Check the database URL and Firebase read/write permissions.")
            time.sleep(POLL_SECONDS)
        except urllib.error.URLError as error:
            print(f"Could not connect to Firebase: {error.reason}")
            time.sleep(POLL_SECONDS)
        except (TimeoutError, json.JSONDecodeError, ValueError, KeyError) as error:
            print(f"Could not read or process data: {error}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
