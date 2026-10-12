
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Severity = "low" | "medium" | "high";
type Category = "all" | "uv" | "light" | "gas" | "distance" | "other";
type Period = "1h" | "24h" | "7d" | "30d" | "all" | "custom";
type Tab = "notViewed" | "viewed";

type AlertRecord = {
  id: string;
  sensor: string;
  value: number | null;
  message: string;
  severity: Severity;
  timestamp: Date | null;
  viewed: boolean;
};

const C = {
  background: "#050b14",
  card: "#0b1729",
  border: "#26364b",
  cyan: "#67e8f9",
  text: "#f1f5f9",
  muted: "#91a4bb",
  low: "#4ade80",
  medium: "#fbbf24",
  high: "#f87171",
};

const categories: { label: string; value: Category }[] = [
  { label: "All Alerts", value: "all" },
  { label: "UV Alerts", value: "uv" },
  { label: "Light Alerts", value: "light" },
  { label: "Gas Alerts", value: "gas" },
  { label: "Distance Alerts", value: "distance" },
  { label: "Other Alerts", value: "other" },
];

const periods: { label: string; value: Period }[] = [
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
  { label: "Custom dates", value: "custom" },
];

function severityColor(severity: Severity) {
  if (severity === "high") return C.high;
  if (severity === "medium") return C.medium;
  return C.low;
}

function getCategory(sensor: string): Category {
  const s = sensor.toLowerCase();

  if (s.includes("uv") || s.includes("ultraviolet")) return "uv";

  if (
    s.includes("light") ||
    s.includes("lux") ||
    s.includes("brightness")
  ) {
    return "light";
  }

  if (
    s.includes("gas") ||
    s.includes("air") ||
    s.includes("pollution") ||
    s.includes("smoke")
  ) {
    return "gas";
  }

  if (
    s.includes("distance") ||
    s.includes("proximity") ||
    s.includes("obstacle")
  ) {
    return "distance";
  }

  return "other";
}

function parseAlertDate(value: unknown): Date | null {
  if (!value) return null;

  // Firestore Timestamp
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Some earlier records may have stored a Date, Unix timestamp, or date string.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDate(date: Date | null) {
  if (!date) return "Timestamp unavailable";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function dateInputValue(date: Date) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function getRange(
  period: Period,
  accountCreated: Date,
  customStart: string,
  customEnd: string,
  now: Date
) {
  let start = new Date(now);
  let end = new Date(now);

  if (period === "all") {
    start = new Date(accountCreated);
  } else if (period === "custom") {
    start = customStart
      ? new Date(`${customStart}T00:00:00`)
      : new Date(accountCreated);

    end = customEnd
      ? new Date(`${customEnd}T23:59:59.999`)
      : new Date(now);

    if (start < accountCreated) start = new Date(accountCreated);
    if (end > now) end = new Date(now);
  } else {
    if (period === "1h") start.setHours(start.getHours() - 1);
    if (period === "24h") start.setHours(start.getHours() - 24);
    if (period === "7d") start.setDate(start.getDate() - 7);
    if (period === "30d") start.setDate(start.getDate() - 30);

    if (start < accountCreated) start = new Date(accountCreated);
  }

  return { start, end };
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 9px",
        borderRadius: 8,
        border: `1px solid ${active ? C.cyan : C.border}`,
        background: active ? C.cyan : "#102239",
        color: active ? "#06121f" : C.text,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.25,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={labelStyle}>{title}</p>
      <div style={filterRowStyle}>{children}</div>
    </div>
  );
}

function TimeFilter({
  period,
  setPeriod,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  accountCreated,
  today,
}: {
  period: Period;
  setPeriod: (period: Period) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  accountCreated: Date;
  today: Date;
}) {
  return (
    <FilterGroup title="TIME PERIOD">
      {periods.map((item) => (
        <FilterButton
          key={item.value}
          active={period === item.value}
          onClick={() => setPeriod(item.value)}
        >
          {item.label}
        </FilterButton>
      ))}

      {period === "custom" && (
        <div style={dateGridStyle}>
          <label style={fieldLabelStyle}>
            Start date
            <input
              type="date"
              value={startDate}
              min={dateInputValue(accountCreated)}
              max={dateInputValue(today)}
              onChange={(event) => setStartDate(event.target.value)}
              style={dateInputStyle}
            />
          </label>

          <label style={fieldLabelStyle}>
            End date
            <input
              type="date"
              value={endDate}
              min={startDate || dateInputValue(accountCreated)}
              max={dateInputValue(today)}
              onChange={(event) => setEndDate(event.target.value)}
              style={dateInputStyle}
            />
          </label>
        </div>
      )}
    </FilterGroup>
  );
}

function AlertCard({
  alert,
  updating,
  onMarkViewed,
}: {
  alert: AlertRecord;
  updating: boolean;
  onMarkViewed: (id: string) => void;
}) {
  const color = severityColor(alert.severity);

  return (
    <article
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <div
            style={{
              display: "flex",
              gap: 9,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ color: C.text }}>
              {alert.sensor.toUpperCase()}
            </strong>

            <span
              style={{
                color,
                background: `${color}18`,
                border: `1px solid ${color}70`,
                borderRadius: 20,
                padding: "4px 9px",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {alert.severity.toUpperCase()}
            </span>
          </div>

          <p
            style={{
              color: "#dce8f6",
              fontSize: 14,
              lineHeight: 1.6,
              margin: "12px 0",
            }}
          >
            {alert.message}
          </p>

          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
            Reading: {alert.value ?? "Not available"} ·{" "}
            {formatDate(alert.timestamp)}
          </p>
        </div>

        {!alert.viewed ? (
          <button
            type="button"
            title="Mark as viewed"
            aria-label="Mark alert as viewed"
            disabled={updating}
            onClick={() => onMarkViewed(alert.id)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: `1px solid ${C.low}`,
              background: `${C.low}18`,
              color: C.low,
              fontSize: 21,
              fontWeight: 800,
              cursor: updating ? "wait" : "pointer",
            }}
          >
            {updating ? "…" : "✓"}
          </button>
        ) : (
          <span style={{ color: C.low, fontSize: 12, fontWeight: 700 }}>
            ✓ Viewed
          </span>
        )}
      </div>
    </article>
  );
}

function categoryColor(category: Exclude<Category, "all">) {
  const colors: Record<Exclude<Category, "all">, string> = {
    uv: "#c084fc",
    light: "#60a5fa",
    gas: "#fb923c",
    distance: "#4ade80",
    other: "#cbd5e1",
  };
  return colors[category];
}

function AlertGraph({
  alerts,
  start,
  end,
}: {
  alerts: AlertRecord[];
  start: Date;
  end: Date;
}) {
  const width = 760;
  const height = 270;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const bucketCount = 12;
  const duration = Math.max(1, end.getTime() - start.getTime());
  const bucketDuration = duration / bucketCount;
  const graphCategories: Exclude<Category, "all">[] = [
    "uv", "light", "gas", "distance", "other",
  ];

  const buckets = Array.from({ length: bucketCount }, () => ({
    uv: 0, light: 0, gas: 0, distance: 0, other: 0,
  }));

  alerts.forEach((alert) => {
    if (!alert.timestamp) return;
    const elapsed = alert.timestamp.getTime() - start.getTime();
    const index = Math.floor(elapsed / bucketDuration);
    const category = getCategory(alert.sensor);
    if (index >= 0 && index < bucketCount && category !== "all") {
      buckets[index][category]++;
    }
  });

  const max = Math.max(1, ...buckets.map((bucket) =>
    graphCategories.reduce((sum, category) => sum + bucket[category], 0)
  ));
  const x = (i: number) => left + (i / (bucketCount - 1)) * chartWidth;
  const y = (value: number) => top + chartHeight - (value / max) * chartHeight;
  const pointString = (category: Exclude<Category, "all">) =>
    buckets.map((bucket, i) => `${x(i)},${y(bucket[category])}`).join(" ");
  const intervalLabel = (i: number) =>
    new Date(start.getTime() + i * bucketDuration).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric",
    });

  const categoryLabels: Record<Exclude<Category, "all">, string> = {
    uv: "UV Alerts",
    light: "Light Alerts",
    gas: "Gas Alerts",
    distance: "Distance Alerts",
    other: "Other Alerts",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {graphCategories.map((category) => (
          <span key={category} style={{
            color: categoryColor(category), fontSize: 12, fontWeight: 700,
          }}>
            ● {categoryLabels[category]}
          </span>
        ))}
      </div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label="Viewed alerts over time by alert category"
          style={{ width: "100%", minWidth: 520, display: "block" }}>
          {[0, 1, 2, 3, 4].map((step) => {
            const value = (max * step) / 4;
            const yy = y(value);
            return <g key={step}>
              <line x1={left} y1={yy} x2={width - right} y2={yy}
                stroke={C.border} strokeDasharray="4 4" />
              <text x={left - 9} y={yy + 4} fill={C.muted} fontSize="10"
                textAnchor="end">{Math.round(value)}</text>
            </g>;
          })}
          {graphCategories.map((category) => (
            <g key={category}>
              <polyline points={pointString(category)} fill="none"
                stroke={categoryColor(category)} strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" />
              {buckets.map((bucket, i) => (
                <circle key={`${category}-${i}`} cx={x(i)}
                  cy={y(bucket[category])} r="3.5"
                  fill={categoryColor(category)} />
              ))}
            </g>
          ))}
          {buckets.map((_, i) => <text key={i} x={x(i)} y={height - 12}
            fill={C.muted} fontSize="9" textAnchor="middle">
            {i % 2 === 0 ? intervalLabel(i) : ""}
          </text>)}
        </svg>
      </div>
      <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
        Each line represents a category of recorded alerts. Only saved alert events are included.
      </p>
    </div>
  );
}

export default function AlertsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Main tabs: only the selected tab's content is shown.
  const [activeTab, setActiveTab] = useState<Tab>("notViewed");

  // Independent filters for each tab.
  const [notCategory, setNotCategory] = useState<Category>("all");
  const [viewCategory, setViewCategory] = useState<Category>("all");
  const [notSeverity, setNotSeverity] = useState<"all" | Severity>("all");
  const [viewSeverity, setViewSeverity] = useState<"all" | Severity>("all");

  const [notPeriod, setNotPeriod] = useState<Period>("1h");
  const [viewPeriod, setViewPeriod] = useState<Period>("1h");
  const [notStart, setNotStart] = useState("");
  const [notEnd, setNotEnd] = useState("");
  const [viewStart, setViewStart] = useState("");
  const [viewEnd, setViewEnd] = useState("");

  const [graphOpen, setGraphOpen] = useState(false);
  const [graphPeriod, setGraphPeriod] = useState<Period>("1h");
  const [graphStart, setGraphStart] = useState("");
  const [graphEnd, setGraphEnd] = useState("");

  useEffect(() => {
    setCurrentTime(new Date());
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAlerts([]);
      setLoading(false);
      setError("Please log in to view your alerts.");
      return;
    }

    setLoading(true);

    // Do not use orderBy("timestamp") here: Firestore excludes documents
    // that do not contain that field, which can hide older alert records.
    const alertsQuery = query(collection(db, "users", user.uid, "alerts"));

    return onSnapshot(
      alertsQuery,
      (snapshot) => {
        const records: AlertRecord[] = snapshot.docs.map((alertDoc) => {
          const data = alertDoc.data();

          const severity: Severity =
            data.severity === "high" ||
            data.severity === "medium" ||
            data.severity === "low"
              ? data.severity
              : "low";

          return {
            id: alertDoc.id,
            sensor: String(data.sensor ?? "unknown"),
            value: typeof data.value === "number" ? data.value : null,
            message: String(data.message ?? "Sensor alert"),
            severity,
            timestamp: parseAlertDate(data.timestamp),
            // Older alerts predate the `viewed` field and should be Not Viewed.
            viewed: data.viewed === true,
          };
        });

        records.sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.getTime() - a.timestamp.getTime();
        });

        setAlerts(records);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Error loading alerts:", snapshotError);
        setError(
          "Unable to load alerts. Check your connection and Firestore permissions."
        );
        setLoading(false);
      }
    );
  }, [user, authLoading]);

  const accountCreated = useMemo(() => {
    const createdAt = user?.metadata.creationTime;
    return createdAt ? new Date(createdAt) : new Date(0);
  }, [user]);

  async function markViewed(id: string) {
    if (!user || updatingId) return;

    setUpdatingId(id);
    setError("");

    try {
      await updateDoc(doc(db, "users", user.uid, "alerts", id), {
        viewed: true,
        viewedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Unable to mark alert as viewed:", err);
      setError("Could not save the viewed status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  function filterAlerts(
    viewed: boolean,
    category: Category,
    severity: "all" | Severity,
    period: Period,
    startDate: string,
    endDate: string
  ) {
    const { start, end } = getRange(
      period,
      accountCreated,
      startDate,
      endDate,
      currentTime ?? accountCreated
    );

    return alerts.filter((alert) => {
      if (alert.viewed !== viewed) return false;
      if (category !== "all" && getCategory(alert.sensor) !== category) {
        return false;
      }
      if (severity !== "all" && alert.severity !== severity) return false;

      // In All time, retain legacy records that have no usable timestamp.
      // For bounded periods, a missing timestamp cannot be placed accurately.
      if (!alert.timestamp) return period === "all";

      const time = alert.timestamp.getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }

  const notViewedAlerts = filterAlerts(
    false, notCategory, notSeverity, notPeriod, notStart, notEnd
  );

  const viewedAlerts = filterAlerts(
    true, viewCategory, viewSeverity, viewPeriod, viewStart, viewEnd
  );

  const graphAlerts = filterAlerts(
    true, viewCategory, "all", graphPeriod, graphStart, graphEnd
  );

  const graphRange = getRange(
    graphPeriod, accountCreated, graphStart, graphEnd,
    currentTime ?? accountCreated
  );

  function renderCategories(
    selected: Category,
    setSelected: (value: Category) => void
  ) {
    return categories.map((category) => (
      <FilterButton
        key={category.value}
        active={selected === category.value}
        onClick={() => setSelected(category.value)}
      >
        {category.label}
      </FilterButton>
    ));
  }

  function renderSeverities(
    selected: "all" | Severity,
    setSelected: (value: "all" | Severity) => void
  ) {
    return (["all", "low", "medium", "high"] as const).map((severity) => (
      <FilterButton
        key={severity}
        active={selected === severity}
        onClick={() => setSelected(severity)}
      >
        {severity === "all"
          ? "All severities"
          : severity[0].toUpperCase() + severity.slice(1)}
      </FilterButton>
    ));
  }

  if (authLoading) {
    return <main style={pageStyle}>Checking your login…</main>;
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <section style={sectionStyle}>
            <h1>Login required</h1>
            <p style={{ color: C.muted }}>Please log in to view your alerts.</p>
            <Link href="/login" style={primaryButtonStyle}>Go to Login</Link>
          </section>
        </div>
      </main>
    );
  }

  const currentAlerts =
    activeTab === "notViewed" ? notViewedAlerts : viewedAlerts;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>SMART SPECTACLES · SAFETY EVENTS</p>
            <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px, 4vw, 38px)" }}>
              Alert History
            </h1>
            <p style={{ color: C.muted, margin: 0, lineHeight: 1.6 }}>
              Review environmental alerts and track the alerts you have viewed.
            </p>
          </div>
          <Link href="/dashboard" style={secondaryButtonStyle}>
            ← Dashboard
          </Link>
        </header>

        {error && (
          <div role="alert" style={{ ...sectionStyle, color: "#fecaca" }}>
            {error}
          </div>
        )}

        <div style={summaryStripStyle}>
          <div style={summaryItemStyle}>
            <span style={summaryLabelStyle}>TOTAL ALERTS</span>
            <strong style={{ fontSize: 25 }}>{alerts.length}</strong>
          </div>
          <div style={summaryItemStyle}>
            <span style={summaryLabelStyle}>NOT VIEWED</span>
            <strong style={{ color: C.medium, fontSize: 25 }}>
              {alerts.filter((alert) => !alert.viewed).length}
            </strong>
          </div>
          <div style={summaryItemStyle}>
            <span style={summaryLabelStyle}>VIEWED</span>
            <strong style={{ color: C.low, fontSize: 25 }}>
              {alerts.filter((alert) => alert.viewed).length}
            </strong>
          </div>
        </div>

        {/* Main tabs: side by side. Only the active tab content appears. */}
        <div
          role="tablist"
          aria-label="Alert viewing status"
          style={tabGridStyle}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "notViewed"}
            onClick={() => setActiveTab("notViewed")}
            style={{
              ...tabStyle,
              background: activeTab === "notViewed" ? C.cyan : C.card,
              color: activeTab === "notViewed" ? "#06121f" : C.text,
              borderColor: activeTab === "notViewed" ? C.cyan : C.border,
            }}
          >
            <span style={{ fontSize: 14 }}>◉</span>
            <strong style={{ fontSize: 13 }}>Not Viewed</strong>
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              {alerts.filter((a) => !a.viewed).length} alerts
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "viewed"}
            onClick={() => setActiveTab("viewed")}
            style={{
              ...tabStyle,
              background: activeTab === "viewed" ? C.cyan : C.card,
              color: activeTab === "viewed" ? "#06121f" : C.text,
              borderColor: activeTab === "viewed" ? C.cyan : C.border,
            }}
          >
            <span style={{ fontSize: 14 }}>✓</span>
            <strong style={{ fontSize: 13 }}>Viewed</strong>
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              {alerts.filter((a) => a.viewed).length} alerts
            </span>
          </button>
        </div>

        {/* Only the selected tab's filters and alert history are rendered. */}
        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 23 }}>
            {activeTab === "notViewed" ? "Not Viewed Alerts" : "Viewed Alerts"}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 0 }}>
            {activeTab === "notViewed"
              ? "Select a category, severity, and time period to find alerts."
              : "Review saved alerts and explore the graph for this category."}
          </p>

          <FilterGroup title="1. ALERT CATEGORY">
            {renderCategories(
              activeTab === "notViewed" ? notCategory : viewCategory,
              activeTab === "notViewed" ? setNotCategory : setViewCategory
            )}
          </FilterGroup>

          <FilterGroup title="2. SEVERITY">
            {renderSeverities(
              activeTab === "notViewed" ? notSeverity : viewSeverity,
              activeTab === "notViewed" ? setNotSeverity : setViewSeverity
            )}
          </FilterGroup>

          <div style={{ marginTop: 22 }}>
            <TimeFilter
              period={activeTab === "notViewed" ? notPeriod : viewPeriod}
              setPeriod={activeTab === "notViewed" ? setNotPeriod : setViewPeriod}
              startDate={activeTab === "notViewed" ? notStart : viewStart}
              setStartDate={activeTab === "notViewed" ? setNotStart : setViewStart}
              endDate={activeTab === "notViewed" ? notEnd : viewEnd}
              setEndDate={activeTab === "notViewed" ? setNotEnd : setViewEnd}
              accountCreated={accountCreated}
              today={currentTime ?? accountCreated}
            />
          </div>

          {activeTab === "viewed" && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setGraphOpen((open) => !open)}
                style={primaryButtonStyle}
              >
                {graphOpen ? "Hide Graph ↑" : "View Graph ↗"}
              </button>

              {graphOpen && (
                <div style={{ ...innerCardStyle, marginTop: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Viewed Alert Graph</h3>
                  <p style={{ color: C.muted, fontSize: 13 }}>
                    This graph follows the selected category above and has its
                    own time-period filter.
                  </p>

                  <TimeFilter
                    period={graphPeriod}
                    setPeriod={setGraphPeriod}
                    startDate={graphStart}
                    setStartDate={setGraphStart}
                    endDate={graphEnd}
                    setEndDate={setGraphEnd}
                    accountCreated={accountCreated}
                    today={currentTime ?? accountCreated}
                  />

                  <div style={{ marginTop: 20 }}>
                    {graphAlerts.length === 0 ? (
                      <p style={{ color: C.muted }}>
                        No viewed alerts were found for this graph period.
                      </p>
                    ) : (
                      <AlertGraph
                        alerts={graphAlerts}
                        start={graphRange.start}
                        end={graphRange.end}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <div style={listHeaderStyle}>
              <h3 style={{ margin: 0 }}>Alert History</h3>
              <span style={{ color: C.muted, fontSize: 12 }}>
                {currentAlerts.length} matching alerts
              </span>
            </div>

            {loading ? (
              <div style={innerCardStyle}>Loading alerts…</div>
            ) : currentAlerts.length === 0 ? (
              <div style={innerCardStyle}>
                <strong>No alerts found</strong>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 0 }}>
                  Try a different category, severity, or time period.
                </p>
              </div>
            ) : (
              currentAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  updating={updatingId === alert.id}
                  onMarkViewed={markViewed}
                />
              ))
            )}
          </div>
        </section>

        <footer style={footerStyle}>
          Smart Spectacles · Environmental Safety System
        </footer>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px 20px",
  background:
    "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
  color: C.text,
  fontFamily: "Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
};

const sectionStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
};

const innerCardStyle: React.CSSProperties = {
  background: "#081322",
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 14,
  color: C.text,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 26,
};

const eyebrowStyle: React.CSSProperties = {
  color: C.cyan,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 2,
  margin: "0 0 10px",
};

const labelStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.2,
  margin: "0 0 8px",
};

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const dateGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  width: "100%",
  marginTop: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: C.muted,
  fontSize: 12,
};

const dateInputStyle: React.CSSProperties = {
  background: "#102239",
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 12,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const tabGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginBottom: 16,
};

const tabStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  minWidth: 0,
  padding: "10px 8px",
  border: "1px solid",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
};

const summaryStripStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 22,
};

const summaryItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 18,
};

const summaryLabelStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: 11,
  letterSpacing: 1,
  fontWeight: 800,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: `1px solid ${C.cyan}`,
  background: C.cyan,
  color: "#06121f",
  borderRadius: 10,
  padding: "11px 16px",
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: `1px solid ${C.border}`,
  background: "#102239",
  color: C.text,
  borderRadius: 10,
  padding: "11px 15px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};

const listHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  marginBottom: 14,
};

const footerStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#64748b",
  fontSize: 12,
  padding: "12px 0 24px",
};
