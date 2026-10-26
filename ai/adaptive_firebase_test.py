"""
Smart Spectacles: Firebase adaptive-threshold test.

Reads live sensor values, calculates adaptive thresholds,
and saves adaptive results separately in Firebase.

Does not modify the existing sensor readings under /current.
"""

import json
import time
import urllib.error
import urllib.request

from adaptive_thresholds import create_engines


# Firebase paths for the Prachi spectacles device.
FIREBASE_URL = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/current.json"
)

FIREBASE_ADAPTIVE_URL = (
    "https://smart-spectacle-47402-default-rtdb.firebaseio.com/"
    "devices/Prachi-spectacles-001/adaptive.json"
)

POLL_SECONDS = 5
SENSOR_KEYS = ("uv", "gas", "light", "distance")

# These match the website's current project/test defaults. They are not
# calibrated real-world safety limits. Never allow adaptation to relax them.
FIXED_THRESHOLDS = {
    "uv": 3000,
    "gas": 2000,
    "light": 800,
    "distance": 30,
}


def is_fixed_warning(sensor, reading):
    threshold = FIXED_THRESHOLDS[sensor]
    if sensor in ("uv", "gas"):
        return reading > threshold
    return reading < threshold


def conservative_threshold(sensor, fixed_threshold, adaptive_threshold):
    """Choose the stricter threshold so adaptation can only add sensitivity."""
    if sensor in ("uv", "gas"):
        return min(fixed_threshold, adaptive_threshold)
    return max(fixed_threshold, adaptive_threshold)


def read_firebase():
    """Read the latest sensor record without changing it."""
    request = urllib.request.Request(
        FIREBASE_URL,
        headers={"Accept": "application/json"},
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def write_adaptive_results(results):
    """Save adaptive results separately from live sensor readings."""
    payload = json.dumps(results).encode("utf-8")

    request = urllib.request.Request(
        FIREBASE_ADAPTIVE_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )

    with urllib.request.urlopen(request, timeout=10) as response:
        print(f"Adaptive results saved (HTTP {response.status}).")


def main():
    engines = create_engines()

    print("Smart Spectacles - Adaptive Threshold Test")
    print("Sensor readings: read from Firebase /current")
    print("Adaptive results: written to Firebase /adaptive")
    print("Learning pauses when a warning is detected.")
    print("Press Ctrl+C to stop.")
    print("-" * 55)

    while True:
        try:
            data = read_firebase()

            if not isinstance(data, dict):
                print("No sensor record found, or response is not an object.")
                time.sleep(POLL_SECONDS)
                continue

            print(
                f"\nLatest Firebase readings "
                f"({time.strftime('%H:%M:%S')}):"
            )

            latest_results = {}

            for sensor in SENSOR_KEYS:
                reading = data.get(sensor)

                if (
                    not isinstance(reading, (int, float))
                    or isinstance(reading, bool)
                ):
                    print(f"  {sensor}: no valid numeric reading")
                    continue

                engine = engines[sensor]

                # Fixed warnings remain authoritative. Adaptive thresholds
                # may add earlier warnings, but must never relax fixed ones.
                reading_value = float(reading)
                fixed_threshold = FIXED_THRESHOLDS[sensor]
                fixed_warning = is_fixed_warning(sensor, reading_value)
                adaptive_warning = engine.is_warning(reading_value)

                # Pause learning on either kind of warning, so hazardous
                # readings are never learned as the user's normal baseline.
                result = engine.observe(
                    reading_value,
                    hazardous=(fixed_warning or adaptive_warning),
                )
                effective_threshold = conservative_threshold(
                    sensor,
                    fixed_threshold,
                    result["adaptiveThreshold"],
                )
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
                    "adaptiveWarning": adaptive_warning,
                    "effectiveThreshold": round(effective_threshold, 3),
                    "warning": bool(combined_warning),
                    "validatedForRealWorldUse": False,
                }

                print(
                    f"  {sensor}: reading={reading_value}, "
                    f"fixed={fixed_threshold}, "
                    f"adaptive={result['adaptiveThreshold']}, "
                    f"effective={effective_threshold}, "
                    f"warning={combined_warning}, "
                    f"status={result['learningStatus']}"
                )

            if latest_results:
                adaptive_record = {
                    "sensors": latest_results,
                    "updatedAt": int(time.time() * 1000),
                }

                write_adaptive_results(adaptive_record)
            else:
                print("No valid sensor readings; nothing was saved.")

            time.sleep(POLL_SECONDS)

        except KeyboardInterrupt:
            print("\nTest stopped.")
            break

        except urllib.error.HTTPError as error:
            print(f"Firebase HTTP error: {error.code} {error.reason}")
            print("Check the database URL and Firebase read/write permissions.")
            time.sleep(POLL_SECONDS)

        except urllib.error.URLError as error:
            print(f"Could not connect to Firebase: {error.reason}")
            print("Check your internet connection and Firebase URL.")
            time.sleep(POLL_SECONDS)

        except (TimeoutError, json.JSONDecodeError, ValueError, KeyError) as error:
            print(f"Could not read or process data: {error}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()