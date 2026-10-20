
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SensorAlert = {
  sensor: "uv" | "gas" | "light" | "distance" | "visual_comfort";
  value: number | null;
  message: string;
  severity: "low" | "medium" | "high";
  eventId?: string;
};

export async function saveSensorAlert(
  userId: string,
  alert: SensorAlert
): Promise<void> {
  if (!userId) {
    throw new Error("A logged-in user is required.");
  }

  const alertsRef = collection(db, "users", userId, "alerts");
  const { eventId, ...alertData } = alert;

  // Ordinary sensor alerts retain their existing behavior.
  if (!eventId) {
    await addDoc(alertsRef, {
      ...alertData,
      userId,
      timestamp: serverTimestamp(),
      acknowledged: false,
      viewed: false,
    });

    return;
  }

  // Sanitize the event ID for use as a Firestore document ID.
  const safeEventId = eventId
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 150);

  if (!safeEventId) {
    throw new Error(
      "A valid eventId is required when deduplicating an alert."
    );
  }

  const alertRef = doc(alertsRef, `ai_${safeEventId}`);

  await runTransaction(db, async (transaction) => {
    const existingAlert = await transaction.get(alertRef);

    // Do not overwrite an existing event or its Viewed status.
    if (existingAlert.exists()) {
      return;
    }

    transaction.set(alertRef, {
      ...alertData,
      eventId: safeEventId,
      userId,
      timestamp: serverTimestamp(),
      acknowledged: false,
      viewed: false,
    });
  });
}
