import {
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SensorReading = {
  deviceId: string;
  uv: number | null;
  gas: number | null;
  light: number | null;
  distance: number | null;
  blink: number | null;
  risk: string;
};

const HISTORY_INTERVAL_MS = 10_000;

export async function saveSensorReading(
  userId: string,
  reading: SensorReading
) {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const bucket = Math.floor(Date.now() / HISTORY_INTERVAL_MS);
  const timestamp = Timestamp.fromMillis(
    bucket * HISTORY_INTERVAL_MS
  );

  const historyRef = doc(
    db,
    "users",
    userId,
    "sensorHistory",
    `${reading.deviceId}_${bucket}`
  );

  await setDoc(
    historyRef,
    {
      ...reading,
      userId,
      timestamp,
    },
    { merge: true }
  );
}