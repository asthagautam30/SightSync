"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshWeeklyReport = useCallback(async (uid: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await generateWeeklyAIReport(uid);
      setReport(result);
    } catch (err) {
      console.error("Failed to generate weekly report:", err);
      setError(
        "Could not load the weekly report. Check your connection and Firebase permissions, then try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;

      if (!user) {
        setUserId(null);
        setReport(null);
        setError("Please sign in to view your weekly report.");
        setLoading(false);
        setAuthReady(true);
        return;
      }

      setUserId(user.uid);
      setAuthReady(true);
      void refreshWeeklyReport(user.uid);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshWeeklyReport]);

  async function handleRefresh() {
    // Use the current Firebase user so we don't refresh another user's data.
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      setError("Your sign-in session is unavailable. Please sign in again.");
      return;
    }

    await refreshWeeklyReport(currentUser.uid);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-sky-600">
            SIGHTSYNC
          </p>
          <h1 className="text-3xl font-bold">Your Week with SightSync</h1>
          <p className="mt-1 text-sm text-gray-500">
            A friendly look at your readings, important alerts, and helpful next steps from the past seven days.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !authReady || !userId}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh report"}
          </button>

          <a
            href="/dashboard"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to dashboard
          </a>
        </div>
      </header>

      {loading && (
        <p role="status" aria-live="polite">
          Generating your weekly report…
        </p>
      )}

      {!loading && error && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 p-4 text-red-700"
        >
          {error}
        </section>
      )}

      {!loading && !error && report && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Readings saved</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.totalReadings}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Warnings saved this week</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.warningReadings}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Sensor types with readings</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.sensorStats.length}
              </p>
            </div>
          </section>

          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Your week at a glance</h2>
            <p className="mt-2">{report.summary}</p>
            <p className="mt-3 text-xs text-gray-500">
              Period: {report.periodStart} to {report.periodEnd}
            </p>

            {!report.dataAvailable && (
              <p className="mt-3 text-sm text-amber-700">
                There isn’t enough saved data to give a reliable picture of this week yet. Keep your device connected and recording, then check back.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Your readings</h2>
            <p className="text-sm text-gray-600">These numbers help you compare readings over time. They are device readings, not necessarily real-world calibrated measurements.</p>

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
                        <p className="text-gray-500">Lowest</p>
                        <p className="font-semibold">
                          {formatNumber(sensor.minimum)}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">Highest</p>
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
                              <span className="text-gray-600">
                                {day.date}
                              </span>
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
            <h2 className="text-xl font-semibold">What we noticed</h2>

            {report.observations.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {report.observations.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-gray-600">
                There are no extra patterns to highlight yet. Keep recording readings to build a clearer picture over time.
              </p>
            )}
          </section>

          <section className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">Helpful next steps</h2>

            {report.precautions.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {report.precautions.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-gray-600">
                No extra suggestions are available yet. Check back after more readings have been saved.
              </p>
            )}

            <p className="mt-4 text-xs text-gray-500">
              This is a helpful overview of saved device readings, not a medical diagnosis or a guarantee that an environment is safe. Sensor values may not match calibrated real-world measurements. Historical visual-comfort trends are not shown unless they are saved in sensor history.
            </p>
          </section>
        </>
      )}
    </main>
  );
}