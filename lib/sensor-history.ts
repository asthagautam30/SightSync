import {
  addDoc,
  collection,
  serverTimestamp,
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

export async function saveSensorReading(
  userId: string,
  reading: SensorReading
) {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const historyRef = collection(
    db,
    "users",
    userId,
    "sensorHistory"
  );

  await addDoc(historyRef, {
    ...reading,
    userId,
    timestamp: serverTimestamp(),
  });
}