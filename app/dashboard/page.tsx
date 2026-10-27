"use client";

import { doc, getDoc } from "firebase/firestore";
import { getSafetyPrecaution } from "@/lib/safety-precautions";
import PrecautionNotifications from "./precaution-notifications";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { alertManager } from "@/lib/alert-manager";
 import {
  getWeeklyReportWeekKey,
  isWeeklyReportNoticeDismissed,
  dismissWeeklyReportNotice,
} from "@/lib/weekly-report-notice";
import { useRouter } from "next/navigation";

import { ref, onValue } from "firebase/database";

import { signOut } from "firebase/auth";

import { db, realtimeDb, auth } from "@/lib/firebase";

import { useAuth } from "../auth-provider";

// import { saveSensorReading } from "@/lib/sensor-history";

import { saveSensorAlert } from "@/lib/alert-history";
import {
  getDailySensorSummary,
  type DailySensorSummary,
} from "@/lib/daily-sensor-summary";

import {

  checkThreshold,

  getActiveThresholds,

  type ThresholdValues,

} from "@/lib/sensor-thresholds";

// const HISTORY_INTERVAL_MS = 10000;

type SensorKey = "uv" | "gas" | "light" | "distance";

type AdaptiveSensorResult = {
  adaptiveThreshold?: number;
  effectiveThreshold?: number;
  fixedThreshold?: number;
  baseline?: number;
  learningStatus?: string;
  reading?: number;
  baselineEstablished?: boolean;
  initialSamplesCollected?: number;
  initialSamplesRequired?: number;
  batchSamplesCollected?: number;
  batchSamplesRequired?: number;
  consecutiveShiftBatches?: number;
  shiftBatchesRequired?: number;
  warning?: boolean;
  validatedForRealWorldUse?: boolean;
};

type AdaptiveFirebaseData = {
  sensors?: Partial<Record<SensorKey, AdaptiveSensorResult>>;
  updatedAt?: number;
};

type SensorData = {

  uv?: number;

  gas?: number;

  light?: number;

  distance?: number;

  lastSeen?: number | string;

  warnings?: Partial<Record<SensorKey, boolean>>;

  ai?: {
    object?: string;
    objectDetected?: boolean;
    viewing?: boolean;
    viewingTime?: number;
    warning?: boolean;
  };

};

// Convert Firebase/Wokwi timestamps (milliseconds, seconds, or date strings) to ms.
function getLastSeenMs(value: SensorData["lastSeen"]): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

const SENSOR_DETAILS: {

  key: SensorKey;

  title: string;

  message: string;

  icon: string;

  unit: string;

}[] = [

  {

    key: "uv",

    title: "UV Level",

    message: "UV warning detected",

    icon: "☀️",

    unit: "",

  },

  {

    key: "gas",

    title: "Gas / Smoke",

    message: "Gas or smoke warning detected",

    icon: "💨",

    unit: "",

  },

  {

    key: "light",

    title: "Light Level",

    message: "Light level warning detected",

    icon: "💡",

    unit: " raw test units",

  },
{
    key: "distance",
    title: "Viewing Distance",
    message: "Nearby obstacle warning detected",
    icon: "📏",
    unit: " cm",
  },


];

export default function DashboardPage() {

  const router = useRouter();
  const [showWeeklyReportNotice, setShowWeeklyReportNotice] =
    useState(false);
  const [weeklyReportWeekKey, setWeeklyReportWeekKey] = useState("");

  const { user, loading } = useAuth();

  const [data, setData] = useState<SensorData | null>(null);
 const [statusTime, setStatusTime] = useState(0);
 const [sensorActivityTime, setSensorActivityTime] = useState(0);
 const previousSensorSignatureRef = useRef("");
  useEffect(() => {
  if (loading || !user) {
    setShowWeeklyReportNotice(false);
    return;
  }

  let cancelled = false;

  async function checkWeeklyReportNotice() {
    const weekKey = getWeeklyReportWeekKey();

    setWeeklyReportWeekKey(weekKey);

    if (isWeeklyReportNoticeDismissed(user!.uid, weekKey)) {
      setShowWeeklyReportNotice(false);
      return;
    }

    try {
      const summaries = await getDailySensorSummary(user!.uid);

      if (cancelled) return;

      // Show the notice only when historical sensor data exists.
      const hasHistoricalData = summaries.some(
        (summary) => summary.readingCount > 0
      );

      setShowWeeklyReportNotice(hasHistoricalData);
    } catch (error) {
      console.error("Could not check weekly report notice:", error);

      if (!cancelled) {
        setShowWeeklyReportNotice(false);
      }
    }
  }

  void checkWeeklyReportNotice();

  return () => {
    cancelled = true;
  };
}, [user, loading]);
 useEffect(() => {
  const intervalId = window.setInterval(() => {
    setStatusTime(Date.now());
  }, 1000);

  return () => window.clearInterval(intervalId);
 }, []);
  const [historicalSummaries, setHistoricalSummaries] =
  useState<DailySensorSummary[]>([]);
  const [safetyProfile, setSafetyProfile] = useState<{
  screenTime?: string;
  outdoorTime?: string;
  environment?: string;
  warningSensitivity?: string;
 } | null>(null);

  const [lastUpdate, setLastUpdate] = useState("Waiting for readings");

  const [connectionError, setConnectionError] = useState("");

  const [recording, setRecording] = useState(true);

  const [loggingOut, setLoggingOut] = useState(false);

  const [activeThresholds, setActiveThresholds] =

  useState<ThresholdValues>(getActiveThresholds());

  const [adaptiveData, setAdaptiveData] =
  useState<AdaptiveFirebaseData | null>(null);

  const [adaptiveLastUpdated, setAdaptiveLastUpdated] =
  useState<number | null>(null);

  const [thresholdsLoading, setThresholdsLoading] = useState(true);

  // const latestDataRef = useRef<SensorData | null>(null);

  // const savingHistoryRef = useRef(false);

  const previousWarningsRef = useRef<Record<string, boolean>>({});

  const previousThresholdStatesRef = useRef<

  Record<string, boolean>

 >({});

  const alertQueueRef = useRef<Promise<void>>(Promise.resolve());
   useEffect(() => {
  if (loading || !user) {
    setHistoricalSummaries([]);
    return;
  }

  let cancelled = false;

  async function loadHistoricalSummaries() {
    try {
      const summaries = await getDailySensorSummary(user!.uid);

      if (!cancelled) {
        setHistoricalSummaries(summaries);
      }
    } catch (error) {
      console.error("Could not load historical sensor summaries:", error);

      if (!cancelled) {
        setHistoricalSummaries([]);
      }
    }
  }

  void loadHistoricalSummaries();

  const intervalId = window.setInterval(() => {
    void loadHistoricalSummaries();
  }, 5 * 60 * 1000);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
 }, [user, loading]);




  useEffect(() => {
  if (loading) return;

  if (!user) {
    setSafetyProfile(null);
    return;
  }

  const userId = user.uid;
  let cancelled = false;

  async function loadSafetyProfile() {
    try {
      const userRef = doc(db, "users", userId);
      const userSnapshot = await getDoc(userRef);

      if (cancelled) return;

      const profile = userSnapshot.data()?.profile;
      const preferences = userSnapshot.data()?.preferences;

      setSafetyProfile({
        screenTime: profile?.screenTime ?? "",
        outdoorTime: profile?.outdoorTime ?? "",
        environment: profile?.environment ?? "",
        warningSensitivity: preferences?.warningSensitivity ?? "medium",
      });
    } catch (error) {
      console.error("Could not load safety profile:", error);
      if (!cancelled) setSafetyProfile(null);
    }
  }

  loadSafetyProfile();

  return () => {
    cancelled = true;
  };
 }, [user, loading]);




  useEffect(() => {

  if (loading) return;

  if (!user) {

    setThresholdsLoading(false);

    return;

  }

  let cancelled = false;

  async function loadThresholdSettings() {

    try {

      const currentUser = user;

 if (!currentUser) return;

 const userRef = doc(db, "users", currentUser.uid);

      const userSnapshot = await getDoc(userRef);

      if (cancelled) return;

      const settings = userSnapshot.data()?.thresholdSettings;

      if (settings?.mode === "custom" && settings.values) {

        setActiveThresholds(

          getActiveThresholds(settings.values as Partial<ThresholdValues>)

        );

      } else {

        setActiveThresholds(getActiveThresholds());

      }

    } catch (error) {

      console.error("Failed to load threshold settings:", error);

      if (!cancelled) {

        setActiveThresholds(getActiveThresholds());

      }

    } finally {

      if (!cancelled) {

        setThresholdsLoading(false);

      }

    }

  }

  setThresholdsLoading(true);

  loadThresholdSettings();

  return () => {

    cancelled = true;

  };

 }, [user, loading]);

 // Protect the dashboard.

  useEffect(() => {

    if (!loading && !user) {

      router.replace("/login");

    }

  }, [user, loading, router]);

  // Subscribe to live Firebase sensor readings.

useEffect(() => {
  const adaptiveRef = ref(
    realtimeDb,
    "devices/Prachi-spectacles-001/adaptive"
  );

  const unsubscribe = onValue(adaptiveRef, (snapshot) => {
    if (snapshot.exists()) {
      const adaptiveSnapshot = snapshot.val() as AdaptiveFirebaseData;
      setAdaptiveData(adaptiveSnapshot);
      setAdaptiveLastUpdated(
        typeof adaptiveSnapshot.updatedAt === "number"
          ? adaptiveSnapshot.updatedAt
          : null
      );
    } else {
  setAdaptiveData(null);
  setAdaptiveLastUpdated(null);
}
  });

  return () => unsubscribe();
}, []);


  useEffect(() => {

    if (loading || !user) return;

   
 const sensorRef = ref(
  realtimeDb,
  "devices/Prachi-spectacles-001/current"
 );


    const unsubscribe = onValue(

      sensorRef,

      (snapshot) => {

        const sensorData = snapshot.val() as SensorData | null;

        // latestDataRef.current = sensorData;

        setData(sensorData);

        // Fallback heartbeat for older Wokwi sketches that do not send lastSeen.
        // Only sensor values count; AI updates alone must not keep the device connected.
        if (sensorData) {
          const signature = JSON.stringify({
            uv: sensorData.uv ?? null,
            gas: sensorData.gas ?? null,
            light: sensorData.light ?? null,
            distance: sensorData.distance ?? null,
          });
          if (signature !== previousSensorSignatureRef.current) {
            previousSensorSignatureRef.current = signature;
            setSensorActivityTime(Date.now());
          }
        }

        setLastUpdate(new Date().toLocaleTimeString());

        setConnectionError("");

      },

      (error) => {

        console.error("Sensor subscription failed:", error);

        setConnectionError(

          "Unable to read sensor data. Check your Firebase connection."

        );

      }

    );

    return () => unsubscribe();

  }, [user, loading]);

// Save a history record every five seconds while recording is enabled.

//   useEffect(() => {

//     if (loading || !user || !recording) return;

//     const intervalId = setInterval(async () => {

//       const reading = latestDataRef.current;

//       if (!reading || savingHistoryRef.current) return;

//       savingHistoryRef.current = true;

//       try {

// // Keep the existing Firebase warning flags as the source

// // of the saved history risk status.

//         const risk =
//           reading.ai?.warning === true ||
//           SENSOR_DETAILS.some(
//             ({ key }) => reading.warnings?.[key] === true
//           )
//             ? "warning"
//             : "normal";

//         await saveSensorReading(user.uid, {

//           deviceId: "Prachi-spectacles-001",

//           uv: reading.uv ?? null,

//           gas: reading.gas ?? null,

//           light: reading.light ?? null,

//           distance: reading.distance ?? null,

//           blink: null,

//           risk,

//         });

//       } catch (error) {

//         console.error("Sensor history save failed:", error);

//       } finally {

//         savingHistoryRef.current = false;

//       }

//     }, HISTORY_INTERVAL_MS);

//     return () => clearInterval(intervalId);

//   }, [user, loading, recording]);

// Save an alert when a Firebase warning changes from normal to warning.

// The new threshold display below does not change this existing behavior.

  useEffect(() => {

    if (loading || !user || !data) return;

    const warnings = data.warnings ?? {};

    for (const sensor of SENSOR_DETAILS) {

      const isWarning = warnings[sensor.key] === true;

      const wasWarning =

        previousWarningsRef.current[sensor.key] === true;

      if (
  isWarning &&
  !wasWarning &&
  alertManager.shouldSend({
    key: `sensor:${sensor.key}`,
    severity:
      sensor.key === "uv" || sensor.key === "gas"
        ? "critical"
        : "warning",
    message: sensor.message,
  })
) {

        const value = data[sensor.key] ?? null;

        alertQueueRef.current = alertQueueRef.current

          .then(async () => {

            await saveSensorAlert(user.uid, {

              sensor: sensor.key,

              value,

              message: sensor.message,

              severity:

                sensor.key === "uv" || sensor.key === "gas"

                  ? "high"

                  : "medium",

            });

            console.log(`Saved ${sensor.key} alert.`);

          })

          .catch((error) => {

            console.error(

              `Failed to save ${sensor.key} alert:`,

              error

            );

          });

      }

      previousWarningsRef.current[sensor.key] = isWarning;

    }

  }, [data, user, loading]);

  // Save one Visual Comfort alert when the AI warning changes from normal to warning.
  useEffect(() => {
    if (loading || !user || !data?.ai) return;

    const isWarning = data.ai.warning === true;
    const wasWarning =
      previousWarningsRef.current.visualComfort === true;

 if (
  isWarning &&
  !wasWarning &&
  alertManager.shouldSend({
    key: "visualComfort",
    severity: "warning",
    message:
      "Visual Comfort warning: take a break from close or prolonged viewing.",
  })
) {
      alertQueueRef.current = alertQueueRef.current
        .then(async () => {
          await saveSensorAlert(user.uid, {
            sensor: "visualComfort",
            value: data.ai?.viewingTime ?? null,
            message:
              "Visual Comfort warning: take a break from close or prolonged viewing.",
            severity: "medium",
          });
          console.log("Saved Visual Comfort alert.");
        })
        .catch((error) => {
          console.error("Failed to save Visual Comfort alert:", error);
        });
    }

    previousWarningsRef.current.visualComfort = isWarning;
  }, [data?.ai?.warning, data?.ai?.viewingTime, user, loading]);

  // Adaptive results can add earlier warnings, but never relax the
  // user's fixed threshold settings. Ignore missing or stale adaptive data.
  const adaptiveIsFresh =
    adaptiveData !== null &&
    adaptiveLastUpdated !== null &&
    statusTime > 0 &&
    statusTime - adaptiveLastUpdated >= -3000 &&
    statusTime - adaptiveLastUpdated <= 20000;

  const getCombinedThresholdWarning = (
    sensor: SensorKey,
    value: number | null
  ): boolean | null => {
    const fixedWarning = checkThreshold(sensor, value, activeThresholds);
    if (fixedWarning === null) return null;
    if (!adaptiveIsFresh) return fixedWarning;

    const adaptiveSensor = adaptiveData?.sensors?.[sensor];
    // Adaptive thresholds do not influence warnings until the initial
    // baseline has been established from enough valid readings.
    if (adaptiveSensor?.baselineEstablished !== true) return fixedWarning;
    const adaptiveThreshold = adaptiveSensor.adaptiveThreshold;
    if (typeof adaptiveThreshold !== "number" || !Number.isFinite(adaptiveThreshold)) {
      return fixedWarning;
    }

    const fixedThreshold = activeThresholds[sensor];
    const effectiveThreshold =
      sensor === "uv" || sensor === "gas"
        ? Math.min(fixedThreshold, adaptiveThreshold)
        : Math.max(fixedThreshold, adaptiveThreshold);

    const adaptiveWarning =
      sensor === "uv" || sensor === "gas"
        ? value! > effectiveThreshold
        : value! < effectiveThreshold;

    // The fixed warning is always included; adaptation can only add sensitivity.
    return fixedWarning || adaptiveWarning;
  };

  // Save an alert when a reading crosses its active custom threshold.
useEffect(() => {
  if (loading || !user || !data || thresholdsLoading) return;

  for (const sensor of SENSOR_DETAILS) {
    const value = data[sensor.key] ?? null;

    const result = getCombinedThresholdWarning(sensor.key, value);

    // Ignore sensors without a valid reading.
    if (result === null) continue;

    const wasWarning =
      previousThresholdStatesRef.current[sensor.key] === true;

    // Save only when the sensor enters the warning state.
     if (
  result &&
  !wasWarning &&
  alertManager.shouldSend({
    key: `sensor:${sensor.key}`,
    severity:
      sensor.key === "uv" || sensor.key === "gas"
        ? "critical"
        : "warning",
    message: `${sensor.title} threshold warning`,
  })
) {
      const threshold = activeThresholds[sensor.key];

      const message =
  sensor.key === "distance"
    ? `${sensor.title} is below the configured threshold of ${threshold} cm.`
    : sensor.key === "light"
      ? `${sensor.title} is below the configured low-light threshold of ${threshold}.`
      : `${sensor.title} exceeds the configured threshold of ${threshold}.`;
      

      alertQueueRef.current = alertQueueRef.current
        .then(async () => {
          await saveSensorAlert(user.uid, {
            sensor: sensor.key,
            value,
            message,
            severity:
              sensor.key === "uv" || sensor.key === "gas"
                ? "high"
                : "medium",
          });

          console.log(`Saved threshold alert for ${sensor.key}.`);
        })
        .catch((error) => {
          console.error(
            `Failed to save threshold alert for ${sensor.key}:`,
            error
          );
        });
    }

    // Remember the latest threshold status.
    // When the reading returns to normal, a future crossing
    // can generate another alert.
    previousThresholdStatesRef.current[sensor.key] = result;
  }
}, [
  data,
  user,
  loading,
  thresholdsLoading,
  activeThresholds,
  adaptiveData,
  adaptiveLastUpdated,
  statusTime,
]);

  const handleLogout = async () => {

    setLoggingOut(true);

    try {

      await signOut(auth);

      router.replace("/login");

    } catch (error) {

      console.error("Logout failed:", error);

      setLoggingOut(false);

    }

  };

  if (loading) {

    return <main style={pageStyle}>Checking your account...</main>;

  }

  if (!user) return null;

 const warningCount = SENSOR_DETAILS.filter(({ key }) => {
  const firebaseWarning = data?.warnings?.[key] === true;

  const thresholdWarning =
    getCombinedThresholdWarning(key, data?.[key] ?? null) === true;

  return firebaseWarning || thresholdWarning;
}).length;

const safetyPrecautions = SENSOR_DETAILS.flatMap((sensor) => {
  const value = data?.[sensor.key] ?? null;

  const fixedThreshold = activeThresholds[sensor.key];
  const adaptiveSensor = adaptiveData?.sensors?.[sensor.key];
  const adaptiveThreshold =
    adaptiveIsFresh && adaptiveSensor?.baselineEstablished === true
      ? adaptiveSensor.adaptiveThreshold
      : undefined;
  const threshold =
    typeof adaptiveThreshold === "number" && Number.isFinite(adaptiveThreshold)
      ? sensor.key === "uv" || sensor.key === "gas"
        ? Math.min(fixedThreshold, adaptiveThreshold)
        : Math.max(fixedThreshold, adaptiveThreshold)
      : fixedThreshold;

  const thresholdExceeded =
    getCombinedThresholdWarning(sensor.key, value) === true;

  const firebaseWarning =
    data?.warnings?.[sensor.key] === true;

  const exceeded = thresholdExceeded || firebaseWarning;
  const history = historicalSummaries.find(
  (summary) => summary.sensor === sensor.key
);

   const precaution = getSafetyPrecaution({
  sensor: sensor.key,
  value,
  threshold,
  exceeded,
  profile: safetyProfile,
  history: history
    ? {
        anomalyDetected: history.anomalyDetected,
        baselineAvailable: history.baselineAvailable,
        baselineAverage: history.baselineAverage,
        readingCount: history.readingCount,
        unusualCount: history.unusualCount,
      }
    : null,
});

  return precaution ? [precaution] : [];
});
// A non-empty Firebase snapshot can be old data left behind after Wokwi stops.
  // Treat the device as connected only while its lastSeen timestamp is fresh.
  // Wokwi sends a Firebase server timestamp in lastSeen every 2 seconds.
  const lastSeenMs = getLastSeenMs(data?.lastSeen);
  const hasSensorData = data !== null &&
    [data.uv, data.gas, data.light, data.distance].some((value) => value !== undefined && value !== null);
  const lastActivityMs = lastSeenMs ?? (sensorActivityTime > 0 ? sensorActivityTime : null);
  // Use a 6-second heartbeat timeout. If lastSeen is provided by the ESP32,
  // it takes priority; otherwise, changed sensor readings act as a fallback heartbeat.
  const isFresh = lastActivityMs !== null && statusTime > 0 &&
    statusTime - lastActivityMs >= -3_000 && statusTime - lastActivityMs <= 15_000;
  const connected = hasSensorData && isFresh && !connectionError;
  const connectionLabel = connectionError
    ? "Connection error"
    : !hasSensorData
      ? "Waiting for data"
      : connected
        ? "Connected"
        : "Disconnected";
  return (
    <main style={pageStyle}>

      {/* Weekly AI Report popup — INSERT HERE */}
      {showWeeklyReportNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-report-notice-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 0, 0, 0.7)",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 440,
              padding: 24,
              borderRadius: 16,
              border: "1px solid #164e63",
              background: "#0b1729",
              color: "#f1f5f9",
            }}
          >
            <h2 id="weekly-report-notice-title">
              📊 Weekly AI Report
            </h2>

            <p style={mutedTextStyle}>
              Review your recent sensor readings, weekly patterns,
              and suggested precautions.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/weekly-report"
                style={primaryButtonStyle}
                onClick={() => {
                  if (user && weeklyReportWeekKey) {
                    dismissWeeklyReportNotice(
                      user.uid,
                      weeklyReportWeekKey
                    );
                  }
                  setShowWeeklyReportNotice(false);
                }}
              >
                View report →
              </Link>

              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  if (user && weeklyReportWeekKey) {
                    dismissWeeklyReportNotice(
                      user.uid,
                      weeklyReportWeekKey
                    );
                  }
                  setShowWeeklyReportNotice(false);
                }}
              >
                Maybe later
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Your existing dashboard content stays here */}
      <div style={containerStyle}>

        {/* Header */}

        <header style={headerStyle}>

          <Link href="/" style={brandStyle}>

            <span style={{ fontSize: 30 }}>👓</span>

            <span>

              <strong

                style={{

                  display: "block",

                  fontSize: 19,

                }}

              >

                Smart Spectacles

              </strong>

              <span style={brandSubtitleStyle}>

                ENVIRONMENTAL SAFETY SYSTEM

              </span>

            </span>

          </Link>

          <button

            onClick={handleLogout}

            disabled={loggingOut}

            style={secondaryButtonStyle}

          >

            {loggingOut ? "Logging out..." : "Log out"}

          </button>

        </header>

        {/* Navigation */}

        <nav style={navStyle} aria-label="Main navigation">

          <Link href="/dashboard" style={activeNavStyle}>

            Dashboard

          </Link>

          <Link href="/adaptive-learning" style={navLinkStyle}>
            Adaptive Learning
          </Link>

          <Link href="/history" style={navLinkStyle}>

            Sensor History

          </Link>

          <Link href="/alerts" style={navLinkStyle}>

            Alert History

          </Link>

          <Link href="/profile" style={navLinkStyle}>
            Profile Settings
          </Link>
          <Link href="/thresholds" style={navLinkStyle}>
            Alert Settings
          </Link>
          <Link href="/weekly-report" style={navLinkStyle}>
            Weekly AI Report
          </Link>
\

        </nav>

        

        {/* Hero */}

        <section style={heroStyle}>

          <div>

            <p style={eyebrowStyle}>VISUAL COMFORT OVERVIEW</p>

            <h1 style={heroTitleStyle}>

              Visual Comfort

              <br />

              <span style={{ color: "#67e8f9" }}>

                Dashboard

              </span>

            </h1>

            <p style={mutedTextStyle}>

              Check your current visual-comfort assessment and relevant environmental warnings.

            </p>

            <p style={mutedTextStyle}>

              Signed in as{" "}

              <strong style={{ color: "#dce8f6" }}>

                {user.email}

              </strong>

            </p>

          </div>

          <div style={connectionCardStyle}>

            <span style={{ fontSize: 24 }}>◉</span>

            <div>

              <span

                style={{

                  color: "#91a4bb",

                  fontSize: 12,

                }}

              >

                Realtime Database

              </span>

              <strong

                style={{

                  display: "block",

                  marginTop: 5,

                  color: connected ? "#86efac" : "#fcd34d",

                }}

              >

                {connectionLabel}

              </strong>

            </div>

          </div>

        </section>

        {connectionError && (

          <div role="alert" style={errorStyle}>

            {connectionError}

          </div>

        )}

        {/* Summary cards */}

        <section style={summaryGridStyle}>

          <SummaryCard

            icon="📡"

            label="Data connection"

            value={connectionError ? "Error" : !hasSensorData ? "Waiting" : connected ? "Connected" : "Disconnected"}

            detail={

              connected

                ? "Sensor data received"

                : "No reading received yet"

            }

            color={connected ? "#86efac" : "#fcd34d"}

          />

          <SummaryCard

            icon="🛡️"

            label="Safety status"

            value={

              !data

                ? "Awaiting data"

                : warningCount > 0

                  ? "Warning detected"

                  : "No warnings"

            }

            detail={

              !data

                ? "Status unavailable"

                : `${warningCount} active sensor warning${

                    warningCount === 1 ? "" : "s"

                  }`

            }

            color={

              !data

                ? "#fcd34d"

                : warningCount > 0

                  ? "#fca5a5"

                  : "#86efac"

            }

          />

          <SummaryCard

            icon="🕒"

            label="Last sensor update"

            value={lastUpdate}

            detail={connected ? "Live sensor updates" : "Last received update (may be stale)"}

            color="#67e8f9"

          />

        </section>

        {/* Live sensor readings */}

        <section style={sectionStyle}>

          <div style={sectionHeadingStyle}>

            <div>

              <p style={eyebrowStyle}>LIVE MONITORING</p>

              <h2 style={sectionTitleStyle}>Sensor readings</h2>

              <p style={mutedTextStyle}>

                Values received from Firebase.

              </p>

            </div>

            <span style={pillStyle}>

              {connected ? "● LIVE" : "○ WAITING"}

            </span>

          </div>

          <div style={sensorGridStyle}>

            {SENSOR_DETAILS.filter((sensor) => sensor.key !== "distance").map((sensor) => (

              <SensorCard

                key={sensor.key}

                title={sensor.title}

                icon={sensor.icon}

                value={data?.[sensor.key]}

                unit={sensor.unit}

                warning={
  data?.warnings?.[sensor.key] === true ||
  getCombinedThresholdWarning(
    sensor.key,
    data?.[sensor.key] ?? null
  ) === true
}

                hasData={

                  data !== null &&

                  data?.[sensor.key] !== undefined

                }

              />

            ))}

            {/* Visual Comfort is part of Live Monitoring */}
            <article
              style={{
                ...sensorCardStyle,
                borderColor: data?.ai?.warning ? "#f87171" : "#203a50",
              }}
            >
              <div style={summaryTopStyle}>
                <span style={{ fontSize: 25 }}>👁️</span>
                <span
                  style={{
                    ...summaryDotStyle,
                    background: data?.ai?.warning ? "#fb7185" : "#4ade80",
                  }}
                />
              </div>
              <h3 style={sensorTitleStyle}>Visual Comfort</h3>
              <p
                style={{
                  ...sensorValueStyle,
                  fontSize: 25,
                  color: !data?.ai ? "#fcd34d" : data.ai.warning ? "#fda4af" : "#86efac",
                }}
              >
                {!data?.ai ? "Waiting for AI" : data.ai.warning ? "Warning" : "Normal"}
              </p>
              <p style={summaryDetailStyle}>
                {!data?.ai
                  ? "Waiting for the visual-comfort assessment."
                  : data.ai.warning
                    ? "Please take a break from close or prolonged viewing."
                    : "No Visual Comfort warning reported by AI."}
              </p>
              <p style={summaryDetailStyle}>
                Detected object: {data?.ai?.object || "None"}
              </p>
              <p style={summaryDetailStyle}>
                Viewing time: {data?.ai?.viewingTime ?? 0} seconds
              </p>
              <p style={summaryDetailStyle}>
                AI status: {data?.ai ? "Connected" : "Waiting for AI data"}
              </p>
            </article>
          </div>

        </section>

    <PrecautionNotifications precautions={safetyPrecautions} />

    {/* Immediate Safety Precautions */}
    <section style={sectionStyle}>
      <h2 style={{ color: "#e2e8f0", marginBottom: "16px" }}>
        Immediate Safety Precautions
      </h2>

      {safetyPrecautions.length === 0 ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "#102a2a",
            border: "1px solid #245c52",
            color: "#a7f3d0",
          }}
        >
          No configured sensor thresholds are currently exceeded.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {safetyPrecautions.map((precaution) => (
            <div
              key={precaution.sensor}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: `1px solid ${
                  precaution.severity === "urgent" ? "#ef4444" : "#f59e0b"
                }`,
                background:
                  precaution.severity === "urgent" ? "#351717" : "#302714",
                color: "#f8fafc",
              }}
            >
              <h3 style={{ margin: "0 0 8px" }}>
                {precaution.severity === "urgent" ? "🚨 " : "⚠️ "}
                {precaution.title}
              </h3>

              <p style={{ margin: "0 0 8px", color: "#cbd5e1" }}>
                {precaution.message}
              </p>

              <p style={{ margin: 0, lineHeight: 1.6 }}>
                <strong>What to do:</strong> {precaution.action}

              </p>
              {precaution.personalNote && (
  <p
    style={{
      margin: "10px 0 0",
      lineHeight: 1.6,
      color: "#a5f3fc",
    }}
  >
    <strong>Personalised guidance:</strong>{" "}
    {precaution.personalNote}
  </p>
)}
            </div>
          ))}
        </div>
      )}
    </section>
        {/* Existing Firebase warning status */}

        <section style={sectionStyle}>

          <p style={eyebrowStyle}>ENVIRONMENT CHECK</p>

          <h2 style={sectionTitleStyle}>Current safety status</h2>

          <p style={mutedTextStyle}>

            Status reflects the warning flags received from Firebase.

          </p>

          {!data ? (

            <div style={emptyStyle}>

              Sensor status will appear when readings arrive.

            </div>

          ) : (

            <div style={statusListStyle}>

              {SENSOR_DETAILS.map((sensor) => {

                const warning =

                  data.warnings?.[sensor.key] === true;

                return (

                  <div key={sensor.key} style={statusRowStyle}>

                    <span>

                      {sensor.icon} {sensor.title}

                    </span>

                    <span

                      style={{

                        color: warning ? "#fca5a5" : "#86efac",

                        fontWeight: 700,

                      }}

                    >

                      {warning ? "⚠ Warning" : "✓ Normal"}

                    </span>

                  </div>

                );

              })}

              <div style={statusRowStyle}>
                <span>👁️ Visual Comfort</span>
                <span
                  style={{
                    color: data.ai?.warning ? "#fca5a5" : "#86efac",
                    fontWeight: 700,
                  }}
                >
                  {data.ai?.warning ? "⚠ Warning" : "✓ Normal"}
                </span>
              </div>
            </div>

          )}

        </section>

        {/* Quick links */}

        <section style={nextStepsStyle}>

          <div>

            <h2

              style={{

                margin: "0 0 8px",

                fontSize: 19,

              }}

            >

              Your safety data

            </h2>

            <p style={mutedTextStyle}>

              Review historical readings or update your personal

              preferences.

            </p>

          </div>

          <div style={quickLinksStyle}>

            <Link href="/history" style={primaryButtonStyle}>

              View history →

            </Link>

            <Link href="/alerts" style={secondaryLinkStyle}>

              Review alerts

            </Link>

            <Link href="/profile" style={secondaryLinkStyle}>

              Edit profile

            </Link>

          </div>

        </section>

        <footer style={footerStyle}>

          <Link href="/" style={footerLinkStyle}>

            Smart Spectacles

          </Link>

          <span>Environmental Safety System</span>

        </footer>

      </div>

    </main>

  );

}

function SummaryCard({

icon,

label,

value,

detail,

color,

}: {

  icon: string;

  label: string;

  value: string;

  detail: string;

  color: string;

}) {

  return (

    <section style={summaryCardStyle}>

      <div style={summaryTopStyle}>

        <span style={{ fontSize: 23 }}>{icon}</span>

        <span

          style={{

            ...summaryDotStyle,

            background: color,

          }}

        />

      </div>

      <p style={summaryLabelStyle}>{label}</p>

      <strong

        style={{

          display: "block",

          fontSize: 18,

          color,

          overflowWrap: "anywhere",

        }}

      >

        {value}

      </strong>

      <p style={summaryDetailStyle}>{detail}</p>

    </section>

  );

}

function SensorCard({

title,

icon,

value,

unit,

warning,

hasData,

}: {

  title: string;

  icon: string;

  value?: number;

  unit: string;

  warning?: boolean;

  hasData: boolean;

}) {

  const isWarning = warning === true;

  return (

    <article

      style={{

        ...sensorCardStyle,

        borderColor: isWarning ? "#7f2938" : "#203a50",

      }}

    >

      <div style={summaryTopStyle}>

        <span style={{ fontSize: 25 }}>{icon}</span>

        <span

          style={{

            ...summaryDotStyle,

            background: isWarning ? "#fb7185" : "#4ade80",

          }}

        />

      </div>

      <h3 style={sensorTitleStyle}>{title}</h3>

      <p style={sensorValueStyle}>

        {hasData && value !== undefined && value !== null

          ? `${value}${unit}`

          : "--"}

      </p>

      <span

        style={{

          color: isWarning ? "#fda4af" : "#86efac",

          fontSize: 11,

          fontWeight: 700,

        }}

      >

        {isWarning

          ? "⚠ Warning detected"

          : "✓ No warning reported"}

      </span>

    </article>

  );

}

const pageStyle = {

  minHeight: "100vh",

  padding: "24px 18px 40px",

  background:

    "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",

  color: "#f1f5f9",

  fontFamily: "Arial, Helvetica, sans-serif",

};

const containerStyle = {

  maxWidth: "1120px",

  margin: "0 auto",

};

const headerStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: 16,

  flexWrap: "wrap" as const,

  paddingBottom: 22,

  borderBottom: "1px solid #20344b",

};

const brandStyle = {

  display: "flex",

  alignItems: "center",

  gap: 11,

  color: "#f1f5f9",

  textDecoration: "none",

  fontWeight: 800,

};

const brandSubtitleStyle = {

  display: "block",

  marginTop: 5,

  fontSize: 9,

  letterSpacing: "1.5px",

  color: "#67e8f9",

};

const navStyle = {

  display: "flex",

  flexWrap: "wrap" as const,

  gap: 8,

  padding: "18px 0",

};

const navLinkStyle = {

  color: "#a6b8cc",

  textDecoration: "none",

  padding: "10px 13px",

  borderRadius: 9,

  fontSize: 13,

  border: "1px solid transparent",

};

const activeNavStyle = {

  ...navLinkStyle,

  color: "#67e8f9",

  border: "1px solid #164e63",

  background: "rgba(8, 47, 59, 0.65)",

};

const heroStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  flexWrap: "wrap" as const,

  gap: 24,

  padding: "28px 0",

};

const eyebrowStyle = {

  color: "#67e8f9",

  fontSize: 10,

  fontWeight: 800,

  letterSpacing: "1.8px",

  marginBottom: 12,

};

const heroTitleStyle = {

  fontSize: "clamp(30px, 5vw, 44px)",

  lineHeight: 1.15,

  letterSpacing: "-1px",

  margin: "0 0 14px",

};

const mutedTextStyle = {

  color: "#91a4bb",

  fontSize: 13,

  lineHeight: 1.8,

  margin: "7px 0",

};

const connectionCardStyle = {

  display: "flex",

  alignItems: "center",

  gap: 14,

  minWidth: 205,

  padding: 18,

  border: "1px solid #203a50",

  borderRadius: 14,

  background: "rgba(15, 30, 49, 0.8)",

};

const summaryGridStyle = {

  display: "grid",

  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",

  gap: 14,

  marginBottom: 22,

};

const summaryCardStyle = {

  padding: 20,

  border: "1px solid #20344b",

  borderRadius: 15,

  background: "rgba(13, 26, 43, 0.92)",

  minWidth: 0,

};

const summaryTopStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: 12,

};

const summaryDotStyle = {

  width: 8,

  height: 8,

  borderRadius: "50%",

};

const summaryLabelStyle = {

  color: "#91a4bb",

  fontSize: 12,

  margin: "14px 0 8px",

};

const summaryDetailStyle = {

  color: "#71869e",

  fontSize: 12,

  lineHeight: 1.6,

  marginBottom: 0,

};

const sectionStyle = {

  marginTop: 20,

  padding: "clamp(18px, 3vw, 25px)",

  background: "rgba(11, 23, 39, 0.88)",

  border: "1px solid #20344b",

  borderRadius: 17,

  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",

};

const sectionHeadingStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  flexWrap: "wrap" as const,

  gap: 14,

  marginBottom: 22,

};

const sectionTitleStyle = {

  fontSize: 21,

  letterSpacing: "-0.4px",

  margin: "0 0 8px",

};

const pillStyle = {

  color: "#67e8f9",

  background: "rgba(8, 47, 59, 0.65)",

  border: "1px solid #164e63",

  borderRadius: 999,

  padding: "7px 10px",

  fontSize: 10,

  fontWeight: 800,

};

const sensorGridStyle = {

  display: "grid",

  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",

  gap: 14,

};

const sensorCardStyle = {

  padding: 19,

  border: "1px solid #203a50",

  borderRadius: 13,

  background: "linear-gradient(145deg, #102239, #0b1729)",

  minWidth: 0,

};

const sensorTitleStyle = {

  color: "#a8bad0",

  fontSize: 13,

  margin: "18px 0 8px",

};

const sensorValueStyle = {

  fontSize: "clamp(28px, 4vw, 34px)",

  fontWeight: 800,

  color: "#f1f5f9",

  overflowWrap: "anywhere" as const,

  margin: "0 0 13px",

};

const statusListStyle = {

  display: "grid",

  gap: 10,

  marginTop: 18,

};

const statusRowStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  flexWrap: "wrap" as const,

  gap: 12,

  padding: 14,

  borderRadius: 10,

  border: "1px solid #20344b",

  background: "rgba(15, 30, 49, 0.65)",

};

const emptyStyle = {

  padding: 20,

  color: "#91a4bb",

  background: "rgba(15, 30, 49, 0.65)",

  border: "1px dashed #31465e",

  borderRadius: 12,

  fontSize: 13,

};

const testNoticeStyle = {

  padding: 16,

  marginTop: 16,

  marginBottom: 18,

  background: "rgba(120, 80, 10, 0.12)",

  border: "1px solid #665126",

  borderRadius: 12,

};

const recordingPanelStyle = {

  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  flexWrap: "wrap" as const,

  gap: 18,

  padding: 18,

  background: "rgba(15, 30, 49, 0.65)",

  border: "1px solid #203a50",

  borderRadius: 12,

};

const primaryButtonStyle = {

  display: "inline-flex",

  justifyContent: "center",

  alignItems: "center",

  padding: "12px 15px",

  border: "1px solid #67e8f9",

  borderRadius: 10,

  background: "#67e8f9",

  color: "#07111e",

  fontSize: 12,

  fontWeight: 800,

  textDecoration: "none",

  cursor: "pointer",

};

const secondaryButtonStyle = {

  padding: "11px 15px",

  border: "1px solid #31465e",

  borderRadius: 10,

  background: "#102239",

  color: "#dce8f6",

  fontSize: 13,

  fontWeight: 700,

  cursor: "pointer",

  textDecoration: "none",

};

const actionLinkStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: 10,

  marginTop: 15,

  padding: "15px 17px",

  border: "1px solid #164e63",

  borderRadius: 10,

  background: "rgba(8, 47, 59, 0.4)",

  color: "#67e8f9",

  textDecoration: "none",

  fontSize: 13,

  fontWeight: 700,

};

const nextStepsStyle = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  flexWrap: "wrap" as const,

  gap: 20,

  padding: 23,

  marginTop: 20,

  border: "1px solid #164e63",

  borderRadius: 15,

  background:

    "linear-gradient(120deg, rgba(8, 47, 59, 0.65), rgba(13, 26, 43, 0.9))",

};

const quickLinksStyle = {

  display: "flex",

  flexWrap: "wrap" as const,

  gap: 10,

};

const secondaryLinkStyle = {

  ...secondaryButtonStyle,

  display: "inline-flex",

  alignItems: "center",

};

const footerStyle = {

  display: "flex",

  justifyContent: "space-between",

  flexWrap: "wrap" as const,

  gap: 10,

  padding: "28px 2px 8px",

  color: "#71869e",

  fontSize: 12,

};

const footerLinkStyle = {

  color: "#67e8f9",

  textDecoration: "none",

  fontWeight: 700,

};

const errorStyle = {

  padding: 14,

  border: "1px solid #7f2938",

  borderRadius: 10,

  background: "rgba(127, 29, 29, 0.25)",

  color: "#fecdd3",

  fontSize: 13,

};


