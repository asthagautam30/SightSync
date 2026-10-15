
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  // Require at least 2 characters.
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Limit the length of the search query.
  if (query.length > 150) {
    return NextResponse.json(
      { error: "Search text is too long." },
      { status: 400 }
    );
  }

  // Read the API key from .env.local.
  const apiKey = process.env.GEOAPIFY_API_KEY;
  

  if (!apiKey) {
    console.error("GEOAPIFY_API_KEY is missing.");

    return NextResponse.json(
      { error: "Location search is not configured." },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://api.geoapify.com/v1/geocode/autocomplete"
    );

    url.searchParams.set("text", query);
    // url.searchParams.set("type", "city");
    url.searchParams.set("type", "locality");
    url.searchParams.set("limit", "6");
    url.searchParams.set("format", "json");
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("filter", "countrycode:in");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Geoapify request failed:", response.status);

      return NextResponse.json(
        { error: "Location search is temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = await response.json();

    const results = (data.results ?? [])
      .map(
        (place: {
          formatted?: string;
          city?: string;
          state?: string;
          country?: string;
          country_code?: string;
          lat?: number;
          lon?: number;
        }) => ({
          label: place.formatted ?? "",
          city: place.city ?? "",
          state: place.state ?? "",
          country: place.country ?? "",
          countryCode: place.country_code ?? "",
          lat: place.lat ?? null,
          lon: place.lon ?? null,
        })
      )
      .filter(
        (place: { label: string }) => place.label.length > 0
      );

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Location search error:", error);

    return NextResponse.json(
      { error: "Could not search locations. Please try again." },
      { status: 500 }
    );
  }
}
