import { NextResponse } from "next/server";


// Lightweight per-process throttling; deployments should also configure platform-level rate limits.
const requestWindows = new Map<string, { start: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;

type Input = {
  totalReadings?: number;
  warningReadings?: number;
  observations?: unknown;
  sensorStats?: unknown;
  fallbackPrecautions?: unknown;
};

function safeStrings(value: unknown, max: number, maxLength = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

function fallbackAdvice(input: Input): string[] {
  const observations = safeStrings(input.observations, 20);
  const stats = Array.isArray(input.sensorStats) ? input.sensorStats as Record<string, unknown>[] : [];
  const advice: string[] = [];
  const warnings = Number(input.warningReadings ?? 0);
  if (warnings > 0) {
    advice.push("Review the times associated with saved warnings and check whether the readings match what you observed. Do not ignore a live device alert.");
  }
  for (const stat of stats) {
    const sensor = String(stat.sensor ?? "");
    if (sensor === "uv") advice.push("Compare UV sensor trends with time spent outdoors; consider shade and suitable sun protection when appropriate. This sensor is not a calibrated UV index.");
    if (sensor === "gas") advice.push("If gas readings rise, check the device and surroundings without approaching a suspected leak. If a dangerous release is suspected, leave the area and contact local emergency services.");
    if (sensor === "light") advice.push("Compare low-light readings with the environment and sensor placement; brightness readings alone do not establish eye harm.");
    if (sensor === "distance") advice.push("Review short viewing-distance patterns and take comfortable viewing breaks. Do not rely on this sensor for navigation.");
  }
  if (!Number(input.totalReadings ?? 0)) advice.push("More saved readings are needed before a useful personal trend can be inferred.");
  return [...new Set(advice)].slice(0, 8);
}

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const window = requestWindows.get(clientKey);
  if (!window || now - window.start >= RATE_WINDOW_MS) {
    requestWindows.set(clientKey, { start: now, count: 1 });
  } else if (window.count >= RATE_LIMIT) {
    return NextResponse.json({ error: "Too many recommendation requests. Please try again shortly." }, { status: 429 });
  } else {
    window.count += 1;
  }
  if (requestWindows.size > 1000) {
    for (const [key, value] of requestWindows) {
      if (now - value.start >= RATE_WINDOW_MS) requestWindows.delete(key);
    }
  }

  let input: Input;
  try {
    input = await request.json() as Input;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(input.sensorStats) || !Array.isArray(input.observations)) {
    return NextResponse.json({ error: "sensorStats and observations must be arrays" }, { status: 400 });
  }

  const fallback = [
    ...safeStrings(input.fallbackPrecautions, 8),
    ...fallbackAdvice(input),
  ].filter((item, index, list) => list.indexOf(item) === index).slice(0, 8);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      recommendations: fallback,
      source: "personalized_rule_fallback",
      note: "Set GEMINI_API_KEY on the server to enable AI-written recommendations.",
    });
  }

  // Send aggregate summaries only, never account identifiers or raw timestamped records.
  const aggregate = {
    totalReadings: Math.max(0, Math.min(1000000, Number(input.totalReadings) || 0)),
    warningReadings: Math.max(0, Math.min(1000000, Number(input.warningReadings) || 0)),
    observations: safeStrings(input.observations, 12, 300),
    sensorStats: (input.sensorStats as Record<string, unknown>[]).slice(0, 4).map((stat) => ({
      sensor: String(stat.sensor ?? "").slice(0, 20),
      label: String(stat.label ?? "").slice(0, 60),
      readingCount: Number(stat.readingCount) || 0,
      average: Number(stat.average) || 0,
      minimum: Number(stat.minimum) || 0,
      maximum: Number(stat.maximum) || 0,
      dailyAverages: Array.isArray(stat.dailyAverages)
        ? stat.dailyAverages.slice(-7).map((day) => {
            const item = day as Record<string, unknown>;
            return { date: String(item.date ?? "").slice(0, 10), average: Number(item.average) || 0, count: Number(item.count) || 0 };
          })
        : [],
    })),
  };

  try {
    const model = process.env.GEMINI_RECOMMENDATION_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You write cautious, practical weekly recommendations for an experimental smart-spectacles sensor app. Use only the supplied aggregate statistics. Do not diagnose, claim the environment is safe, infer medical conditions, invent calibrated units, or change safety thresholds. Sensor values are uncalibrated project units except distance in cm. If gas may indicate a dangerous release, advise leaving the area and contacting local emergency services. Return a JSON object with a recommendations array containing 3-6 short actionable recommendations, no more than 240 characters each. State uncertainty when evidence is limited.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: JSON.stringify(aggregate) }],
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(`Gemini API returned HTTP ${response.status}${details?.error?.message ? `: ${details.error.message.slice(0, 200)}` : ""}`);
    }
    const payload = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const contentText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");
    if (!contentText) throw new Error("Empty Gemini response");
    const parsed = JSON.parse(contentText) as { recommendations?: unknown };
    const recommendations = safeStrings(parsed.recommendations, 6, 240);
    if (recommendations.length < 1) throw new Error("No valid recommendations returned");
    return NextResponse.json({
      recommendations,
      source: "gemini_aggregate_personalization",
      note: "AI-written suggestions are informational and do not replace fixed alerts or emergency guidance.",
    });
  } catch (error) {
    console.error("Gemini weekly recommendations unavailable; using fallback.", error);
    return NextResponse.json({
      recommendations: fallback,
      source: "personalized_rule_fallback",
      note: "AI recommendations were unavailable; showing the safety-checked fallback.",
    });
  }
}
