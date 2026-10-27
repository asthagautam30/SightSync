import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SensorKey = "uv" | "gas" | "light" | "distance";

export type DailySensorSummary = {
  date: string;
  sensor: SensorKey;
  readingCount: number;
  average: number;
  minimum: number;
  maximum: number;
  unusualCount: number;
  anomalyDetected: boolean;
  baselineAverage: number | null;
  baselineReadingCount: number;
  baselineAvailable: boolean;
};

type SensorReading = {
  deviceId?: string;
  timestamp?: Timestamp | Date | null;
  uv?: number | null;
  gas?: number | null;
  light?: number | null;
  distance?: number | null;
};

const SENSOR_KEYS: SensorKey[] = [
  "uv",
  "gas",
  "light",
  "distance",
];

const BASELINE_DAYS = 7;
const MIN_BASELINE_READINGS = 5;
const ANOMALY_SENSITIVITY = 2;

function getValidValues(
  readings: SensorReading[],
  sensor: SensorKey
): number[] {
  return readings
    .map((reading) => reading[sensor])
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );
}

function calculateAverage(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateStandardDeviation(
  values: number[],
  average: number
): number {
  const variance =
    values.reduce(
      (sum, value) => sum + (value - average) ** 2,
      0
    ) / values.length;

  return Math.sqrt(variance);
}

function isUnusualReading(
  value: number,
  average: number,
  standardDeviation: number
): boolean {
  if (standardDeviation === 0) {
    return value !== average;
  }

  return (
    Math.abs(value - average) / standardDeviation >
    ANOMALY_SENSITIVITY
  );
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function getDailySensorSummary(
  userId: string,
  selectedDate: Date = new Date()
): Promise<DailySensorSummary[]> {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const startOfBaseline = new Date(startOfDay);
  startOfBaseline.setDate(
    startOfBaseline.getDate() - BASELINE_DAYS
  );

  const historyRef = collection(
    db,
    "users",
    userId,
    "sensorHistory"
  );

const historyQuery = query(
  historyRef,
  where(
    "timestamp",
    ">=",
    Timestamp.fromDate(startOfBaseline)
  ),
  where(
    "timestamp",
    "<",
    Timestamp.fromDate(startOfNextDay)
  )
);

  const snapshot = await getDocs(historyQuery);

  const allReadings = snapshot.docs
  .map((document) => document.data() as SensorReading)
  .filter(
    (reading) => reading.deviceId === "Prachi-spectacles-001"
  );

  const selectedDateReadings = allReadings.filter((reading) => {
    const timestamp = reading.timestamp;

    if (!timestamp) return false;

    const readingDate =
      timestamp instanceof Timestamp
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

    if (!readingDate || !Number.isFinite(readingDate.getTime())) {
      return false;
    }

    return (
      readingDate >= startOfDay &&
      readingDate < startOfNextDay
    );
  });

  const historicalReadings = allReadings.filter((reading) => {
    const timestamp = reading.timestamp;

    if (!timestamp) return false;

    const readingDate =
      timestamp instanceof Timestamp
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

    if (!readingDate || !Number.isFinite(readingDate.getTime())) {
      return false;
    }

    return readingDate < startOfDay;
  });

  const date = formatDate(startOfDay);
  const summaries: DailySensorSummary[] = [];

  for (const sensor of SENSOR_KEYS) {
    const values = getValidValues(selectedDateReadings, sensor);

    if (values.length === 0) {
      continue;
    }

    const average = calculateAverage(values);

    const baselineValues = getValidValues(
      historicalReadings,
      sensor
    );

    const baselineAvailable =
      baselineValues.length >= MIN_BASELINE_READINGS;

    let unusualCount = 0;

    if (baselineAvailable) {
      const baselineAverage = calculateAverage(baselineValues);
      const baselineDeviation = calculateStandardDeviation(
        baselineValues,
        baselineAverage
      );

      unusualCount = isUnusualReading(
        average,
        baselineAverage,
        baselineDeviation
      )
        ? 1
        : 0;
    }

    summaries.push({
      date,
      sensor,
      readingCount: values.length,
      average: Number(average.toFixed(2)),
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      unusualCount,
      anomalyDetected: unusualCount > 0,
      baselineAverage: baselineAvailable
        ? Number(calculateAverage(baselineValues).toFixed(2))
        : null,
      baselineReadingCount: baselineValues.length,
      baselineAvailable,
    });
  }

  return summaries;
}