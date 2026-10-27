import { NextResponse } from "next/server";

const allowedSensors = new Set(["uv", "gas", "light", "distance"]);
const windows = new Map<string, { start: number; count: number }>();

type Input = {
  precautions?: Array<{
    sensor?: string;
    title?: string;
    message?: string;
    action?: string;
    severity?: string;
    reading?: number | null;
  }>;
  profile?: {
    screenTime?: string;
    outdoorTime?: string;
    environment?: string;
    warningSensitivity?: string;
  } | null;
};

function clean(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fallbackTips(precautions: NonNullable<Input["precautions"]>) {
  return precautions.flatMap((p) => {
    const sensor = clean(p.sensor);
    const tip =
      sensor === "uv" ? "If you are outdoors, seek shade when practical, wear a brimmed hat and protective clothing, and use sunscreen as appropriate. This sensor is not a calibrated UV index." :
      sensor === "gas" ? "Move away from a suspected source and get fresh air if safe. If a dangerous gas release is possible, leave the area and contact local emergency services; do not investigate the source." :
      sensor === "light" ? "Move to a better-lit area if safe, reduce glare, and pause tasks if you cannot see clearly. This reading does not establish eye harm." :
      sensor === "distance" ? "Pause and check the path carefully. Ask for assistance if visibility is poor; never rely on this experimental sensor alone for navigation." : "";
    return allowedSensors.has(sensor) && tip ? [{ sensor, tip }] : [];
  });
}

export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const window = windows.get(client);
  if (!window || now - window.start > 60_000) windows.set(client, { start: now, count: 1 });
  else if (window.count >= 8) return NextResponse.json({ error: "Please wait before requesting more personalized tips." }, { status: 429 });
  else window.count++;

  let input: Input;
  try {
    input = await request.json() as Input;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const precautions = (Array.isArray(input.precautions) ? input.precautions : [])
    .filter((p) => p && allowedSensors.has(clean(p.sensor)))
    .slice(0, 4)
    .map((p) => ({
      sensor: clean(p.sensor),
      title: clean(p.title, 100),
      message: clean(p.message, 300),
      // Fixed action is included as a safety constraint; Gemini must not replace it.
      requiredSafetyAction: clean(p.action, 500),
      severity: clean(p.severity, 20),
      reading: typeof p.reading === "number" && Number.isFinite(p.reading) ? p.reading : null,
    }));

  if (!precautions.length) return NextResponse.json({ tips: [], source: "none" });

  const fallback = fallbackTips(precautions);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ tips: fallback, source: "safe_fallback", note: "Gemini is not configured; showing standard precautions." });
  }

  const profile = input.profile ? {
    screenTime: clean(input.profile.screenTime, 80),
    outdoorTime: clean(input.profile.outdoorTime, 80),
    environment: clean(input.profile.environment, 80),
    warningSensitivity: clean(input.profile.warningSensitivity, 20),
  } : null;

  try {
    const configuredModel = process.env.GEMINI_RECOMMENDATION_MODEL || "gemini-3.8-flash";
    const models = [...new Set([configuredModel, "gemini-3.6-flash", "gemini-3.5-flash-lite"])];
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text:
        "You are the personalization assistant for an experimental smart-spectacles sensor dashboard. For each supplied active sensor warning, write one clear, friendly, concise personalized tip (max 320 characters) using only the supplied profile and sensor context. Tailor to profile when relevant; never invent profile facts. The requiredSafetyAction is mandatory safety guidance: do not contradict, weaken, or omit it. UV values are not a calibrated UV index; gas readings do not identify gas or concentration; light readings do not establish eye harm; distance sensors cannot be relied on for navigation. Do not diagnose, claim a person or environment is safe, or infer medical conditions. For possible dangerous gas release, advise leaving the area and contacting local emergency services. Return JSON only: {\"tips\":[{\"sensor\":\"uv|gas|light|distance\",\"tip\":\"...\"}]}. Include exactly one tip for each supplied sensor."
      }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ profile, precautions }) }] }],
      generationConfig: { temperature: 0.25, responseMimeType: "application/json", maxOutputTokens: 800 },
    });

    let response: Response | undefined;
    const failures: string[] = [];
    for (const model of models) {
      try {
        const candidate = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
            body: requestBody,
            signal: AbortSignal.timeout(9000),
          },
        );
        if (candidate.ok) {
          response = candidate;
          break;
        }
        const details = await candidate.json().catch(() => null) as { error?: { message?: string } } | null;
        const message = details?.error?.message?.slice(0, 120) ?? "";
        failures.push(`${model}: HTTP ${candidate.status}${message ? ` - ${message}` : ""}`);
        if (![404, 500, 502, 503, 504].includes(candidate.status)) {
          throw new Error(`Gemini returned HTTP ${candidate.status}${message ? `: ${message}` : ""}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          failures.push(`${model}: request timed out`);
          continue;
        }
        throw error;
      }
    }
    if (!response) throw new Error(`No Gemini model responded successfully. ${failures.join(" | ")}`);
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text) as { tips?: unknown };
    const supplied = Array.isArray(parsed.tips) ? parsed.tips : [];
    const tips = supplied.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as { sensor?: unknown; tip?: unknown };
      const sensor = clean(value.sensor, 20);
      const tip = clean(value.tip, 320);
      return allowedSensors.has(sensor) && tip && precautions.some((p) => p.sensor === sensor)
        ? [{ sensor, tip }]
        : [];
    });
    const unique = [...new Map(tips.map((tip) => [tip.sensor, tip])).values()];
    // Never return an incomplete set: fixed safe fallback covers any omitted sensor.
    const merged = precautions.map((p) => unique.find((t) => t.sensor === p.sensor) ?? fallback.find((t) => t.sensor === p.sensor)).filter((t): t is { sensor: string; tip: string } => Boolean(t));
    const allAi = precautions.every((p) => unique.some((t) => t.sensor === p.sensor));
    return NextResponse.json({
      tips: merged,
      source: allAi ? "gemini_ai" : "mixed_ai_and_safe_fallback",
      note: "AI personalizes wording only. Fixed safety actions remain authoritative.",
    });
  } catch (error) {
    console.error("Personalized Gemini safety tips unavailable; using safe fallback.", error);
    return NextResponse.json({
      tips: fallback,
      source: "safe_fallback",
      note: "Gemini was unavailable; fixed safety guidance is still shown.",
    });
  }
}
