import { NextResponse } from "next/server";

type RiskPredictionInput = {
  uv: number;
  gas: number;
  light: number;
  distance: number;
  uv_baseline: number;
  gas_baseline: number;
  light_baseline: number;
  distance_baseline: number;
};

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "A sensor-reading object is required." }, { status: 400 });
  }

  const body = input as Record<string, unknown>;
  const fields: (keyof RiskPredictionInput)[] = [
    "uv", "gas", "light", "distance",
    "uv_baseline", "gas_baseline", "light_baseline", "distance_baseline",
  ];

  const invalidFields = fields.filter((field) => !isNonNegativeNumber(body[field]));
  if (invalidFields.length) {
    return NextResponse.json({
      error: "All sensor readings and baselines must be non-negative numbers.",
      invalidFields,
    }, { status: 400 });
  }

  const baseUrl = (process.env.RISK_MODEL_API_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.fromEntries(fields.map((field) => [field, body[field]]))),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json({
        error: "The Random Forest service could not complete the prediction.",
        details: result?.detail ?? result?.error ?? null,
      }, { status: response.status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({
      error: "The Random Forest service is unavailable. Start the local model API and try again.",
    }, { status: 503 });
  }
}
