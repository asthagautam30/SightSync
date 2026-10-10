import { generateThresholdRecommendation } from "./threshold-recommendations";

const enoughData = {
  sensor: "uv" as const,
  currentThreshold: 50,
  historicalAverage: 20,
  historicalReadingCount: 100,
  recentAverage: 35,
  recentReadingCount: 10,
};

const resultWithEnoughData =
  generateThresholdRecommendation(enoughData);

const resultWithInsufficientData =
  generateThresholdRecommendation({
    ...enoughData,
    historicalReadingCount: 3,
  });

console.assert(
  resultWithEnoughData.status === "review",
  "Test 1 failed: sufficient data should allow a review."
);

console.assert(
  resultWithEnoughData.suggestedThreshold === 50,
  "Test 2 failed: the engine must preserve the current threshold."
);

console.assert(
  resultWithInsufficientData.status === "insufficient-data",
  "Test 3 failed: insufficient history should be identified."
);

console.assert(
  resultWithInsufficientData.suggestedThreshold === 50,
  "Test 4 failed: insufficient data must not change the threshold."
);

console.log("Sufficient data result:", resultWithEnoughData);
console.log("Insufficient data result:", resultWithInsufficientData);
console.log("Recommendation tests completed.");