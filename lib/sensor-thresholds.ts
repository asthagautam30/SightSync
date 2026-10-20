
export type SensorKey = "uv" | "gas" | "light" | "distance";

export type SensorThreshold = {
  label: string;
  unit: string;
  warningAbove?: number;
  warningBelow?: number;
  description: string;
};

export type ThresholdValues = Record<SensorKey, number>;

export const DEFAULT_THRESHOLD_VALUES: ThresholdValues = {
  uv: 50,
  gas: 300,
  light: 500,
  distance: 50,
};

export const SENSOR_THRESHOLDS: Record<SensorKey, SensorThreshold> = {
  uv: {
    label: "UV Sensor (ML8511)",
    unit: " test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.uv,
    description: "TEST ONLY: Not a calibrated UV index.",
  },

  gas: {
    label: "Gas / Smoke (MQ-135)",
    unit: " test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.gas,
    description: "TEST ONLY: Not a calibrated gas concentration.",
  },

  light: {
    label: "Light Sensor (BH1750 / GY-302)",
    unit: " lux",
    warningAbove: DEFAULT_THRESHOLD_VALUES.light,
    description: "TEST ONLY: Not a validated harmful-light limit.",
  },

  distance: {
    label: "Distance Sensor (HC-SR04)",
    unit: " cm",
    warningBelow: DEFAULT_THRESHOLD_VALUES.distance,
    description: "TEST ONLY: Proximity test threshold.",
  },
};

/**
 * Returns true only for finite, positive threshold values.
 */
function isValidThreshold(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

/**
 * Returns the active threshold values.
 * Invalid, missing, zero, and negative custom values fall back
 * to the corresponding defaults.
 */
export function getActiveThresholds(
  customValues?: Partial<ThresholdValues> | null
): ThresholdValues {
  function validOrDefault(
    value: unknown,
    fallback: number
  ): number {
    return isValidThreshold(value) ? value : fallback;
  }

  return {
    uv: validOrDefault(
      customValues?.uv,
      DEFAULT_THRESHOLD_VALUES.uv
    ),

    gas: validOrDefault(
      customValues?.gas,
      DEFAULT_THRESHOLD_VALUES.gas
    ),

    light: validOrDefault(
      customValues?.light,
      DEFAULT_THRESHOLD_VALUES.light
    ),

    distance: validOrDefault(
      customValues?.distance,
      DEFAULT_THRESHOLD_VALUES.distance
    ),
  };
}

/**
 * Checks whether a sensor has a configured default warning direction.
 */
export function isThresholdConfigured(sensor: SensorKey): boolean {
  return (
    SENSOR_THRESHOLDS[sensor].warningAbove !== undefined ||
    SENSOR_THRESHOLDS[sensor].warningBelow !== undefined
  );
}

/**
 * Returns:
 * - true when the threshold is exceeded
 * - false when the reading is within the threshold
 * - null when the reading is missing or invalid
 *
 * Distance warns below its threshold.
 * UV, gas, and light warn above their thresholds.
 */
export function checkThreshold(
  sensor: SensorKey,
  value: number | null,
  thresholds?: Partial<ThresholdValues> | null
): boolean | null {
  if (
    value === null ||
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const active = getActiveThresholds(thresholds);
  const threshold = active[sensor];

  if (sensor === "distance") {
    return value < threshold;
  }

  return value > threshold;
}
