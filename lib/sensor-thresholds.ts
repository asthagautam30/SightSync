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
    label: "UV Rays",
    unit: "test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.uv,
    description:
      "Measures the current UV sensor reading. This is a project test value, not a calibrated UV index.",
  },

  gas: {
    label: "Gas Level",
    unit: "test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.gas,
    description:
      "Measures the gas sensor reading. This is a project test value, not a calibrated gas concentration.",
  },

  light: {
    label: "Light Intensity",
    unit: "test units",
    warningAbove: DEFAULT_THRESHOLD_VALUES.light,
    description:
      "Measures the current light sensor reading. Confirm calibration before interpreting it as lux.",
  },

  distance: {
    label: "Viewing Distance",
    unit: "cm",
    warningBelow: DEFAULT_THRESHOLD_VALUES.distance,
    description:
      "Measures the distance to a nearby object. The warning threshold is configured in centimeters.",
  },
};

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
  return (
    SENSOR_THRESHOLDS[sensor].warningAbove !== undefined ||
    SENSOR_THRESHOLDS[sensor].warningBelow !== undefined
  );
}

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

  if (sensor === "distance") {
    return value < threshold;
  }

  return value > threshold;
}