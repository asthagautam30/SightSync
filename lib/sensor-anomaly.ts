export type AnomalySensor = "uv" | "gas" | "light" | "distance";

export type AnomalyResult = {
  sensor: AnomalySensor;
  currentValue: number;
  baselineAverage: number;
  deviation: number;
  unusual: boolean;
  message: string;
};

type SensorBaseline = {
  average: number;
  standardDeviation: number;
};

/**
 * Calculates the average and population standard deviation.
 */
function calculateBaseline(values: number[]): SensorBaseline {
  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;

  return {
    average,
    standardDeviation: Math.sqrt(variance),
  };
}

/**
 * Flags a reading that differs from the baseline by more than
 * the configured number of standard deviations.
 *
 * This detects statistical differences, not confirmed safety risks.
 */
export function detectSensorAnomaly(
  sensor: AnomalySensor,
  currentValue: number | null,
  historicalValues: number[],
  sensitivity = 2
): AnomalyResult | null {
  if (
    currentValue === null ||
    !Number.isFinite(currentValue) ||
    historicalValues.length < 5 ||
    !Number.isFinite(sensitivity) ||
    sensitivity <= 0
  ) {
    return null;
  }

  const validValues = historicalValues.filter(
    (value) => Number.isFinite(value)
  );

  if (validValues.length < 5) {
    return null;
  }

  const baseline = calculateBaseline(validValues);

  const difference = currentValue - baseline.average;

  const deviation =
    baseline.standardDeviation === 0
      ? difference === 0
        ? 0
        : Number.POSITIVE_INFINITY
      : Math.abs(difference) / baseline.standardDeviation;

  const unusual = deviation > sensitivity;

  const direction =
    difference > 0
      ? "higher"
      : difference < 0
        ? "lower"
        : "equal to";

  return {
    sensor,
    currentValue,
    baselineAverage: Number(baseline.average.toFixed(2)),
    deviation,
    unusual,
    message: unusual
      ? `${sensor.toUpperCase()} reading is unusually ${direction} than its historical baseline.`
      : `${sensor.toUpperCase()} reading is within its statistical baseline.`,
  };
}