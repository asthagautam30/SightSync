import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type SensorKey = "uv" | "gas" | "light" | "distance";

type SensorReading = {
  timestamp?: Timestamp | Date | null;
  uv?: number | null;
  gas?: number | null;
  light?: number | null;
  distance?: number | null;
  risk?: string;
};

export type WeeklySensorStat = {
  sensor: SensorKey;
  label: string;
  unit: string;
  readingCount: number;
  average: number;
  minimum: number;
  maximum: number;
  dailyAverages: {
    date: string;
    average: number;
    count: number;
  }[];
};

export type WeeklyAIReport = {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalReadings: number;
  warningReadings: number;
  dataAvailable: boolean;
  summary: string;
  observations: string[];
  precautions: string[];
  sensorStats: WeeklySensorStat[];
  recommendationSource?: string;
  recommendationNote?: string;
};

const SENSORS: {
  key: SensorKey;
  label: string;
  unit: string;
  precaution: string;
}[] = [
  {
    key: "uv",
    label: "UV readings",
    unit: "sensor units",
    precaution:
      "Review elevated readings and consider shade and suitable sun protection outdoors. The sensor is not a calibrated UV index.",
  },
  {
    key: "gas",
    label: "Gas and smoke readings",
    unit: "sensor units",
    precaution:
      "Review elevated readings and possible environmental sources. If a dangerous gas release is suspected, leave the area and contact local emergency services.",
  },
  {
    key: "light",
    label: "Light levels",
    unit: "sensor units",
    precaution:
      "Review changes in brightness and adjust your surroundings if needed. Brightness alone does not establish that light is harmful.",
  },
  {
    key: "distance",
    label: "Viewing distance",
    unit: "cm",
    precaution:
      "Review unusually short distance readings and keep checking your path. Never rely on the sensor alone for navigation.",
  },
];

function toDate(value: SensorReading["timestamp"]): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  return null;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function generateWeeklyAIReport(
  userId: string
): Promise<WeeklyAIReport> {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 7);

  const historyRef = collection(
    db,
    "users",
    userId,
    "sensorHistory"
  );

  const historyQuery = query(
    historyRef,
    where("timestamp", ">=", Timestamp.fromDate(periodStart)),
    where("timestamp", "<=", Timestamp.fromDate(now))
  );

  const snapshot = await getDocs(historyQuery);

  const readings = snapshot.docs
    .map((document) => document.data() as SensorReading)
    .filter((reading) => {
      const timestamp = toDate(reading.timestamp);
      return (
        timestamp !== null &&
        timestamp >= periodStart &&
        timestamp <= now
      );
    });

  const warningReadings = readings.filter(
    (reading) => reading.risk?.toLowerCase() === "warning"
  ).length;

  const sensorStats: WeeklySensorStat[] = SENSORS.flatMap((sensor) => {
    const validReadings = readings.flatMap((reading) => {
      const value = reading[sensor.key];

      return typeof value === "number" && Number.isFinite(value)
        ? [{ value, timestamp: toDate(reading.timestamp)! }]
        : [];
    });

    if (validReadings.length === 0) {
      return [];
    }

    const grouped = new Map<string, number[]>();

    for (const reading of validReadings) {
      const key = dateKey(reading.timestamp);
      const values = grouped.get(key) ?? [];
      values.push(reading.value);
      grouped.set(key, values);
    }

    const dailyAverages = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        average: Number(average(values).toFixed(2)),
        count: values.length,
      }));

    const values = validReadings.map((reading) => reading.value);

    return [
      {
        sensor: sensor.key,
        label: sensor.label,
        unit: sensor.unit,
        readingCount: values.length,
        average: Number(average(values).toFixed(2)),
        minimum: Math.min(...values),
        maximum: Math.max(...values),
        dailyAverages,
      },
    ];
  });

  const observations: string[] = [];
  const precautions: string[] = [];

  if (readings.length === 0) {
    observations.push(
      "No timestamped sensor readings were found for the past seven days."
    );
  } else {
    observations.push(
      `Your device saved ${readings.length} readings this week.`
    );

    observations.push(
      `${warningReadings} saved records were marked as warnings. This may not include every alert shown live on your device.`
    );

    for (const stat of sensorStats) {
      const daily = stat.dailyAverages;

      observations.push(
        `${stat.label}: ${stat.readingCount} readings were saved. The typical reading was ${stat.average}; values ranged from ${stat.minimum} to ${stat.maximum}. These are device readings, not necessarily calibrated real-world measurements.`
      );

      if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];

        if (last.average > first.average) {
          observations.push(
            `${stat.label} daily average increased from ${first.average} to ${last.average} over the available daily summaries.`
          );
        } else if (last.average < first.average) {
          observations.push(
            `${stat.label} daily average decreased from ${first.average} to ${last.average} over the available daily summaries.`
          );
        } else {
          observations.push(
            `${stat.label} daily average was unchanged between the first and last available daily summaries.`
          );
        }
      }

      precautions.push(
        SENSORS.find((sensor) => sensor.key === stat.sensor)!.precaution
      );
    }
  }

  let recommendationSource = "personalized_rule_fallback";
  let recommendationNote = "Showing safety-checked recommendations based on available sensor summaries.";
  if (readings.length > 0) {
    try {
      const response = await fetch("/api/weekly-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalReadings: readings.length,
          warningReadings,
          observations: observations.slice(0, 12),
          sensorStats,
          fallbackPrecautions: precautions,
        }),
      });
      if (response.ok) {
        const generated = await response.json() as {
          recommendations?: unknown;
          source?: string;
          note?: string;
        };
        if (Array.isArray(generated.recommendations)) {
          const safeRecommendations = generated.recommendations.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          ).slice(0, 8);
          if (safeRecommendations.length > 0) {
            precautions.splice(0, precautions.length, ...safeRecommendations);
            recommendationSource = generated.source ?? recommendationSource;
            recommendationNote = generated.note ?? recommendationNote;
          }
        }
      }
    } catch (error) {
      console.warn("Weekly recommendation service unavailable; using fallback.", error);
    }
  }

  return {
    recommendationSource,
    recommendationNote,
    generatedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    totalReadings: readings.length,
    warningReadings,
    dataAvailable: readings.length > 0,
    summary:
      readings.length === 0
        ? "There is not enough recorded sensor history to produce a meaningful weekly summary yet. Keep the device connected and recording."
        : `Here is your week at a glance: ${readings.length} readings were saved across ${sensorStats.length} sensor types, with ${warningReadings} records marked as warnings. Review the notes and simple next steps below.`,
    observations,
    precautions,
    sensorStats,
  };
}