export type SensorKey = "uv" | "gas" | "light" | "distance";

export type SensorThreshold = {
  label: string;
  unit: string;
  warningAbove?: number;
  warningBelow?: number;
  description: string;
};

export type ThresholdValues = Record<SensorKey, number>;

/**
 * Simulation defaults aligned with the current ESP32/Wokwi sketch.
 * These are raw test readings, not calibrated real-world safety limits.
 */
export const DEFAULT_THRESHOLD_VALUES: ThresholdValues = {
  uv: 3000,
  gas: 2000,
  light: 800,
  distance: 30,
};

export const SENSOR_THRESHOLDS: Record<SensorKey, SensorThreshold> = {
  uv: {
    label: "UV Rays",
    unit: "raw test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.uv,
    description:
      "Warns when the raw UV sensor reading exceeds the configured test threshold. This is not a calibrated UV index.",
  },

  gas: {
    label: "Gas / Smoke",
    unit: "raw test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.gas,
    description:
      "Warns when the raw gas sensor reading exceeds the configured test threshold. This does not identify a specific gas or concentration.",
  },

  light: {
    label: "Light Level",
    unit: "raw test units",
    warningBelow: DEFAULT_THRESHOLD_VALUES.light,
    description:
      "Warns when the light sensor reading falls below the configured threshold, indicating potentially poor lighting. This is not calibrated lux.",
  },

  distance: {
    label: "Viewing Distance",
    unit: "cm",
    warningBelow: DEFAULT_THRESHOLD_VALUES.distance,
    description:
      "Warns when the measured viewing distance is below the configured proximity threshold.",
  },
};

/**
 * Returns the active threshold values, including saved custom values.
 * This function does not modify or persist user settings.
 */
export function getActiveThresholds(
  customValues?: Partial<ThresholdValues> | null
): ThresholdValues {
  return {
    uv: customValues?.uv ?? DEFAULT_THRESHOLD_VALUES.uv,
    gas: customValues?.gas ?? DEFAULT_THRESHOLD_VALUES.gas,
    light: customValues?.light ?? DEFAULT_THRESHOLD_VALUES.light,
    distance:
      customValues?.distance ?? DEFAULT_THRESHOLD_VALUES.distance,
  };
}

export function isThresholdConfigured(sensor: SensorKey): boolean {
  const threshold = SENSOR_THRESHOLDS[sensor];

  return (
    threshold.warningAbove !== undefined ||
    threshold.warningBelow !== undefined
  );
}

/**
 * Warning direction:
 * - UV and gas: above threshold
 * - Light and distance: below threshold
 *
 * Returns null when the reading is missing or invalid.
 */
export function checkThreshold(
  sensor: SensorKey,
  value: number | null,
  thresholds?: Partial<ThresholdValues> | null
): boolean | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const active = getActiveThresholds(thresholds);
  const threshold = active[sensor];

  if (!Number.isFinite(threshold)) {
    return null;
  }

  switch (sensor) {
    case "uv":
    case "gas":
      return value > threshold;

    case "light":
    case "distance":
      return value < threshold;

    default: {
      const exhaustiveCheck: never = sensor;
      return exhaustiveCheck;
    }
  }
}