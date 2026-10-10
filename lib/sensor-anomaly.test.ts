import { detectSensorAnomaly } from "./sensor-anomaly";

const baseline = [10, 11, 9, 10, 10, 11, 9, 10];

const normalResult = detectSensorAnomaly(
  "uv",
  10,
  baseline
);

const unusualResult = detectSensorAnomaly(
  "uv",
  30,
  baseline
);

const insufficientResult = detectSensorAnomaly(
  "gas",
  100,
  [95, 100, 105]
);

console.assert(
  normalResult !== null && !normalResult.unusual,
  "Test 1 failed: normal reading should not be flagged."
);

console.assert(
  unusualResult !== null && unusualResult.unusual,
  "Test 2 failed: unusually high reading should be flagged."
);

console.assert(
  insufficientResult === null,
  "Test 3 failed: fewer than five historical readings should return null."
);

console.log("Normal reading:", normalResult);
console.log("Unusual reading:", unusualResult);
console.log("Insufficient history:", insufficientResult);
console.log("Anomaly detection tests completed.");