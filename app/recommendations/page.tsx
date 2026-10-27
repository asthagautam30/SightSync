
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/auth-provider";
import {
  generateThresholdRecommendation,
  type ThresholdRecommendation,
} from "@/lib/threshold-recommendations";
import {
  getActiveThresholds,
  type ThresholdValues,
} from "@/lib/sensor-thresholds";

type SensorKey = "uv" | "gas" | "light" | "distance";
type BaselineType = "previous-days" | "same-day" | "unavailable";

type SensorReading = {
  timestamp?: Timestamp | Date | null;
  uv?: number | null;
  gas?: number | null;
  light?: number | null;
  distance?: number | null;
};

type ReviewItem = ThresholdRecommendation & {
  id: string;
  baselineType: BaselineType;
  decision?: "accepted" | "rejected";
};

const SENSOR_LABELS: Record<SensorKey, string> = {
  uv: "UV Sensor",
  gas: "Gas / Smoke Sensor",
  light: "Light Sensor",
  distance: "Distance Sensor",
};

const MIN_BASELINE_READINGS = 20;
const MIN_RECENT_READINGS = 5;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#07111f",
  color: "#e5eefb",
  padding: "32px 20px",
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#101e30",
  border: "1px solid #263850",
  borderRadius: "14px",
  padding: "20px",
};

function getReadingDate(reading: SensorReading): Date | null {
  const timestamp = reading.timestamp;

  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }

  if (timestamp instanceof Date) {
    return Number.isFinite(timestamp.getTime()) ? timestamp : null;
  }

  return null;
}

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

function getAverage(values: number[]): number | null {
  if (values.length === 0) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

export default function RecommendationsPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    async function loadRecommendations() {
      const currentUser = user;
      if (!currentUser) return;

      setFetching(true);
      setError("");

      try {
        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const userRef = doc(db, "users", currentUser.uid);
        const userSnapshot = await getDoc(userRef);
        const userData = userSnapshot.data();

        const settings = userData?.thresholdSettings;

        const activeThresholds: ThresholdValues = getActiveThresholds(
          settings?.mode === "custom" ? settings.values : undefined
        );

        const historyRef = collection(
          db,
          "users",
          currentUser.uid,
          "sensorHistory"
        );

        const historyQuery = query(
          historyRef,
          where(
            "timestamp",
            ">=",
            Timestamp.fromDate(sevenDaysAgo)
          ),
          where("timestamp", "<", Timestamp.fromDate(now)),
          orderBy("timestamp", "asc"),
          limit(5000)
        );

        const historySnapshot = await getDocs(historyQuery);

        const readings = historySnapshot.docs
          .map((snapshot) => snapshot.data() as SensorReading)
          .filter((reading) => getReadingDate(reading) !== null);

        const previousDayReadings = readings.filter((reading) => {
          const date = getReadingDate(reading);
          return date !== null && date < todayStart;
        });

        const todayReadings = readings.filter((reading) => {
          const date = getReadingDate(reading);
          return date !== null && date >= todayStart && date < now;
        });

        // Split today's data chronologically.
        // The first 70% becomes a provisional baseline;
        // the last 30% becomes the recent comparison group.
        const splitIndex = Math.floor(todayReadings.length * 0.7);

        const earlierTodayReadings = todayReadings.slice(0, splitIndex);
        const recentTodayReadings = todayReadings.slice(splitIndex);

        const sensorKeys: SensorKey[] = [
          "uv",
          "gas",
          "light",
          "distance",
        ];

        const generated: ReviewItem[] = [];

        for (const sensor of sensorKeys) {
          const previousValues = getValidValues(
            previousDayReadings,
            sensor
          );

          const earlierTodayValues = getValidValues(
            earlierTodayReadings,
            sensor
          );

          const recentTodayValues = getValidValues(
            recentTodayReadings,
            sensor
          );

          // Prefer previous-day data if it is sufficient.
          // Otherwise, use earlier readings from today.
          const usePreviousDays =
            previousValues.length >= MIN_BASELINE_READINGS;

          const baselineValues = usePreviousDays
            ? previousValues
            : earlierTodayValues;

          const recentValues = usePreviousDays
            ? getValidValues(
                todayReadings.filter((reading) => {
                  const date = getReadingDate(reading);
                  return date !== null && date >= todayStart;
                }),
                sensor
              )
            : recentTodayValues;

          const baselineType: BaselineType = usePreviousDays
            ? "previous-days"
            : baselineValues.length >= MIN_BASELINE_READINGS
              ? "same-day"
              : "unavailable";

          const baselineAverage = getAverage(baselineValues);
          const recentAverage = getAverage(recentValues);

          // Do not enable decisions when the evidence is insufficient.
          const recommendation = generateThresholdRecommendation({
            sensor,
            currentThreshold: activeThresholds[sensor],
            historicalAverage:
              baselineValues.length >= MIN_BASELINE_READINGS
                ? baselineAverage
                : null,
            historicalReadingCount: baselineValues.length,
            recentAverage:
              recentValues.length >= MIN_RECENT_READINGS
                ? recentAverage
                : null,
            recentReadingCount: recentValues.length,
          });

          generated.push({
            ...recommendation,
            id: sensor,
            baselineType,
          });
        }

        const reviewsRef = collection(
          db,
          "users",
          currentUser.uid,
          "recommendationReviews"
        );

        const reviewsQuery = query(
          reviewsRef,
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);

        const savedDecisions = new Map<
          string,
          "accepted" | "rejected"
        >();

        for (const review of reviewsSnapshot.docs) {
          const reviewData = review.data();

          if (
            typeof reviewData.sensor === "string" &&
            (reviewData.decision === "accepted" ||
              reviewData.decision === "rejected") &&
            !savedDecisions.has(reviewData.sensor)
          ) {
            savedDecisions.set(
              reviewData.sensor,
              reviewData.decision
            );
          }
        }

        if (!cancelled) {
          setItems(
            generated.map((item) => ({
              ...item,
              decision: savedDecisions.get(item.sensor),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);

        if (!cancelled) {
          setError(
            "Could not load recommendations. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  async function saveDecision(
    item: ReviewItem,
    decision: "accepted" | "rejected"
  ) {
    if (!user) return;

    setError("");
    setNotice("");

    try {
      const reviewsRef = collection(
        db,
        "users",
        user.uid,
        "recommendationReviews"
      );

      await addDoc(reviewsRef, {
        sensor: item.sensor,
        decision,
        currentThreshold: item.currentThreshold,
        suggestedThreshold: item.suggestedThreshold,
        reason: item.reason,
        evidence: item.evidence,
        baselineType: item.baselineType,
        createdAt: serverTimestamp(),
      });

      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? { ...existing, decision }
            : existing
        )
      );

      setNotice(
        decision === "accepted"
          ? "Recommendation accepted for review. Your active threshold has not changed."
          : "Recommendation rejected. Your active threshold remains unchanged."
      );
    } catch (err) {
      console.error("Failed to save recommendation decision:", err);
      setError("Could not save your decision. Please try again.");
    }
  }

  if (loading) {
    return <main style={pageStyle}>Checking your account...</main>;
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <h1>Threshold Recommendations</h1>
        <p>Please log in to review recommendations.</p>
        <Link href="/login" style={{ color: "#67e8f9" }}>
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            marginBottom: "30px",
          }}
        >
          <Link href="/dashboard" style={{ color: "#67e8f9" }}>
            Dashboard
          </Link>
          <Link href="/daily-summary" style={{ color: "#67e8f9" }}>
            Daily Summary
          </Link>
          <Link href="/thresholds" style={{ color: "#67e8f9" }}>
            Threshold Settings
          </Link>
          <Link href="/alerts" style={{ color: "#67e8f9" }}>
            Alerts
          </Link>
        </nav>

        <header style={{ marginBottom: "28px" }}>
          <p
            style={{
              color: "#67e8f9",
              fontSize: "12px",
              letterSpacing: "2px",
              fontWeight: "bold",
            }}
          >
            PERSONALIZED SENSOR INSIGHTS
          </p>

          <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
            Threshold Recommendations
          </h1>

          <p style={{ color: "#9fb1c8", lineHeight: 1.6 }}>
            Review sensor patterns and their evidence. Your active
            thresholds are never changed by this page.
          </p>
        </header>

        <section style={{ ...cardStyle, marginBottom: "24px" }}>
          <h2 style={{ marginTop: 0 }}>How recommendations work</h2>
          <p style={{ color: "#9fb1c8", lineHeight: 1.7 }}>
            Previous-day readings are preferred. When they are
            unavailable, earlier readings from today can provide a
            provisional baseline. This is an experimental statistical
            comparison, not a trained ML model or a validated safety
            assessment.
          </p>
        </section>

        {fetching && <p>Analyzing sensor history...</p>}

        {error && (
          <p role="alert" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            style={{
              color: "#86efac",
              background: "#123328",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            {notice}
          </p>
        )}

        {!fetching && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
            }}
          >
            {items.map((item) => (
              <section key={item.id} style={cardStyle}>
                <h2 style={{ marginTop: 0, fontSize: "20px" }}>
                  {SENSOR_LABELS[item.sensor]}
                </h2>

                <p style={{ color: "#9fb1c8", fontSize: "13px" }}>
                  Current threshold
                </p>

                <p style={{ fontSize: "25px", color: "#67e8f9" }}>
                  <strong>{item.currentThreshold}</strong>
                </p>

                <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                  {item.reason}
                </p>

                <div
                  style={{
                    background: "#07111f",
                    border: "1px solid #263850",
                    borderRadius: "8px",
                    padding: "12px",
                    margin: "16px 0",
                  }}
                >
                  <p style={{ marginTop: 0, fontWeight: "bold" }}>
                    Evidence
                  </p>
                  <p
                    style={{
                      color: "#9fb1c8",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      marginBottom: 0,
                    }}
                  >
                    {item.evidence}
                  </p>
                </div>

                <p style={{ color: "#9fb1c8", fontSize: "13px" }}>
                  Baseline source:{" "}
                  <strong>
                    {item.baselineType === "previous-days"
                      ? "Previous days"
                      : item.baselineType === "same-day"
                        ? "Earlier readings today (provisional)"
                        : "Unavailable"}
                  </strong>
                </p>

                <p style={{ color: "#9fb1c8", fontSize: "13px" }}>
                  Suggested threshold:{" "}
                  <strong>{item.suggestedThreshold}</strong>
                </p>

                <p
                  style={{
                    color:
                      item.status === "review" ? "#fde68a" : "#d6d3d1",
                    fontWeight: "bold",
                  }}
                >
                  {item.status === "review"
                    ? "Ready for review"
                    : "More data needed"}
                </p>

                {item.decision && (
                  <p style={{ color: "#86efac" }}>
                    Your recorded decision: {item.decision}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "18px",
                  }}
                >
                  <button
                    onClick={() => saveDecision(item, "accepted")}
                    disabled={
                      item.status !== "review" ||
                      item.decision === "accepted"
                    }
                    style={{
                      border: "none",
                      borderRadius: "8px",
                      padding: "11px 14px",
                      background: "#0891b2",
                      color: "#ffffff",
                      cursor: "pointer",
                      opacity:
                        item.status !== "review" ||
                        item.decision === "accepted"
                          ? 0.5
                          : 1,
                    }}
                  >
                    Accept for review
                  </button>

                  <button
                    onClick={() => saveDecision(item, "rejected")}
                    disabled={
                      item.status !== "review" ||
                      item.decision === "rejected"
                    }
                    style={{
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      padding: "11px 14px",
                      background: "transparent",
                      color: "#e5eefb",
                      cursor: "pointer",
                      opacity:
                        item.status !== "review" ||
                        item.decision === "rejected"
                          ? 0.5
                          : 1,
                    }}
                  >
                    Reject
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}

        <p
          style={{
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: 1.6,
            marginTop: "28px",
          }}
        >
          Safety note: Sensor readings may be simulated and are not
          calibrated safety measurements. Statistical patterns alone
          cannot establish that an environment is safe or dangerous.
        </p>
      </div>
    </main>
  );
}