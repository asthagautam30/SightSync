 "use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  generateWeeklyAIReport,
  type WeeklyAIReport,
} from "@/lib/weekly-ai-report";

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyAIReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      if (!user) {
        setReport(null);
        setError("Please sign in to view your weekly report.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await generateWeeklyAIReport(user.uid);
        if (!cancelled) setReport(result);
      } catch (err) {
        console.error("Failed to generate weekly report:", err);
        if (!cancelled) {
          setError(
            "Could not load the weekly report. Check your connection and Firebase permissions, then try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-sky-600">SMART SPECTACLES</p>
          <h1 className="text-3xl font-bold">Weekly AI Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sensor trends and precautions from your last seven days of saved history.
          </p>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Back to dashboard
        </a>
      </header>

      {loading && <p role="status">Generating your weekly report…</p>}

      {!loading && error && (
        <section className="rounded-xl border border-red-200 p-4 text-red-700">
          {error}
        </section>
      )}

      {!loading && report && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Saved readings</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.totalReadings}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Saved warning records</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.warningReadings}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Sensors summarized</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.sensorStats.length}
              </p>
            </div>
          </section>

          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Weekly summary</h2>
            <p className="mt-2">{report.summary}</p>
            <p className="mt-3 text-xs text-gray-500">
              Period: {report.periodStart} to {report.periodEnd}
            </p>
            {!report.dataAvailable && (
              <p className="mt-3 text-sm text-amber-700">
                No usable timestamped readings were found for this period.
                The report may be limited until more history is saved.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Sensor statistics</h2>
            {report.sensorStats.length === 0 ? (
              <p className="rounded-xl border p-4 text-gray-600">
                No sensor statistics are available for this week.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {report.sensorStats.map((sensor) => (
                  <article
                    key={sensor.sensor}
                    className="rounded-xl border p-4"
                  >
                    <h3 className="font-semibold">{sensor.label}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {sensor.readingCount} readings · {sensor.unit}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Average</p>
                        <p className="font-semibold">
                          {formatNumber(sensor.average)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Minimum</p>
                        <p className="font-semibold">
                          {formatNumber(sensor.minimum)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Maximum</p>
                        <p className="font-semibold">
                          {formatNumber(sensor.maximum)}
                        </p>
                      </div>
                    </div>

                    {sensor.dailyAverages.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium">
                          Daily averages
                        </p>
                        <ul className="space-y-1 text-sm">
                          {sensor.dailyAverages.map((day) => (
                            <li
                              key={day.date}
                              className="flex justify-between gap-3"
                            >
                              <span className="text-gray-600">{day.date}</span>
                              <span className="font-medium">
                                {formatNumber(day.average)} ({day.count})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Observations</h2>
            {report.observations.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {report.observations.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-gray-600">
                No additional observations are available yet.
              </p>
            )}
          </section>

          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Suggested precautions</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {report.precautions.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-gray-500">
              This report summarizes saved sensor data. It is not a medical
              diagnosis, and sensor units are not necessarily calibrated
              real-world measurements.
            </p>
          </section>
        </>
      )}
    </main>
  );
}