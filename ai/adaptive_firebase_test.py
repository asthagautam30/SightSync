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

                # Check whether this reading triggers a warning.
                warning = engine.is_warning(float(reading))

                # Do not learn from readings that trigger a warning.
                result = engine.observe(
                    float(reading),
                    hazardous=warning,
                )

                latest_results[sensor] = {
                    **result,
                    "reading": reading,
                }

                print(
                    f"  {sensor}: reading={reading}, "
                    f"threshold={result['adaptiveThreshold']}, "
                    f"warning={result['warning']}, "
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