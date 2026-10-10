import type { SensorKey } from "@/lib/daily-sensor-summary";

export type ThresholdRecommendation = {
  sensor: SensorKey;
  currentThreshold: number;
  suggestedThreshold: number;
  reason: string;
  evidence: string;
  status: "review" | "insufficient-data";
};

export type RecommendationInput = {
  sensor: SensorKey;
  currentThreshold: number;
  historicalAverage: number | null;
  historicalReadingCount: number;
  recentAverage: number | null;
  recentReadingCount: number;
};

const MIN_HISTORICAL_READINGS = 20;
const MIN_RECENT_READINGS = 5;

/**
 * Generates an experimental recommendation for user review.
 *
 * This function does not save settings or change active thresholds.
 * It does not establish real-world safety limits.
 */
export function generateThresholdRecommendation(
  input: RecommendationInput
): ThresholdRecommendation {
  const {
    sensor,
    currentThreshold,
    historicalAverage,
    historicalReadingCount,
    recentAverage,
    recentReadingCount,
  } = input;

  const hasEnoughData =
    historicalAverage !== null &&
    recentAverage !== null &&
    Number.isFinite(historicalAverage) &&
    Number.isFinite(recentAverage) &&
    historicalReadingCount >= MIN_HISTORICAL_READINGS &&
    recentReadingCount >= MIN_RECENT_READINGS &&
    Number.isFinite(currentThreshold) &&
    currentThreshold > 0;

  if (!hasEnoughData) {
    return {
      sensor,
      currentThreshold,
      suggestedThreshold: currentThreshold,
      reason: "More reliable history is needed.",
      evidence:
        `Historical readings: ${historicalReadingCount}; ` +
        `recent readings: ${recentReadingCount}.`,
      status: "insufficient-data",
    };
  }

  const difference = recentAverage - historicalAverage;
  const changePercent =
    historicalAverage === 0
      ? null
      : (Math.abs(difference) / Math.abs(historicalAverage)) * 100;

  const changeDescription =
    changePercent === null
      ? "The historical average is zero, so a percentage comparison is unavailable."
      : `The recent average differs from the historical average by ${changePercent.toFixed(1)}%.`;

  let reason: string;

  if (sensor === "distance") {
    reason =
      difference < 0
        ? "Recent distance readings are lower than the historical average. Review the proximity setting."
        : difference > 0
          ? "Recent distance readings are higher than the historical average. Review whether the proximity setting remains suitable."
          : "Recent distance readings match the historical average. Review the current proximity setting if needed.";
  } else {
    reason =
      difference > 0
        ? "Recent readings are higher than the historical average. Review the current threshold and sensor conditions."
        : difference < 0
          ? "Recent readings are lower than the historical average. Review the current threshold and sensor conditions."
          : "Recent readings match the historical average. Review the current threshold if needed.";
  }

  return {
    sensor,
    currentThreshold,
    suggestedThreshold: currentThreshold,
    reason,
    evidence:
      `${changeDescription} ` +
      `Historical average: ${historicalAverage}; ` +
      `recent average: ${recentAverage}.`,
    status: "review",
  };
}