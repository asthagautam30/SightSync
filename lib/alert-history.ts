
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SensorAlert = {
  sensor: "uv" | "gas" | "light" | "distance";
  value: number | null;
  message: string;
  severity: "low" | "medium" | "high";
};

export async function saveSensorAlert(
  userId: string,
  alert: SensorAlert
) {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const alertsRef = collection(db, "users", userId, "alerts");

  await addDoc(alertsRef, {
    ...alert,
    userId,
    timestamp: serverTimestamp(),
    acknowledged: false,
  });
}
