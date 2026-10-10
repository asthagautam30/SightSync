
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Severity = "low" | "medium" | "high";
type StatusFilter = "all" | "pending" | "acknowledged";
type SeverityFilter = "all" | Severity;

type AlertRecord = {
  id: string;
  sensor: string;
  value: number | null;
  message: string;
  severity: Severity;
  timestamp: Date | null;
  acknowledged: boolean;
};

const colors = {
  background: "#050b14",
  card: "#0b1729",
  cardBorder: "#26364b",
  cyan: "#67e8f9",
  text: "#f1f5f9",
  muted: "#91a4bb",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px 20px",
  background:
    "radial-gradient(ellipse at top, #142a42 0%, #08111f 46%, #050b14 100%)",
  color: colors.text,
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: colors.card,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.cardBorder,
  borderRadius: "16px",
  padding: "22px",
  marginBottom: "18px",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
  borderWidth: "1px",
  borderStyle: "solid",
};

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
        ...buttonStyle,
        color: active ? "#06121f" : "#cbd5e1",
        background: active ? colors.cyan : "#102239",
        borderColor: active ? colors.cyan : colors.cardBorder,
      }}
    >
      {children}
    </button>
  );
}

function severityColor(severity: Severity) {
  if (severity === "high") return "#f87171";
  if (severity === "medium") return "#fbbf24";
  return colors.cyan;
}

function formatTimestamp(date: Date | null) {
  if (!date) return "Timestamp unavailable";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [selectedSeverity, setSelectedSeverity] =
    useState<SeverityFilter>("all");

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setError("Please log in to view your alerts.");
      setLoading(false);
      return;
    }

    const alertsQuery = query(
      collection(db, "users", user.uid, "alerts"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const records: AlertRecord[] = snapshot.docs.map(
          (alertDoc) => {
            const data = alertDoc.data();

            const severity: Severity =
              data.severity === "high" ||
              data.severity === "medium" ||
              data.severity === "low"
                ? data.severity
                : "low";

            return {
              id: alertDoc.id,
              sensor: data.sensor ?? "unknown",
              value:
                typeof data.value === "number"
                  ? data.value
                  : null,
              message: data.message ?? "Sensor alert",
              severity,
              timestamp: data.timestamp?.toDate
                ? data.timestamp.toDate()
                : null,
              acknowledged: data.acknowledged === true,
            };
          }
        );

        setAlerts(records);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Error loading alerts:", snapshotError);
        setError(
          "Unable to load alerts. Please check your connection and try again."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function acknowledgeAlert(alertId: string) {
    const user = auth.currentUser;

    if (!user) {
      setError("Please log in to acknowledge alerts.");
      return;
    }

    setUpdatingId(alertId);
    setError("");

    try {
      await updateDoc(
        doc(db, "users", user.uid, "alerts", alertId),
        {
          acknowledged: true,
          acknowledgedAt: serverTimestamp(),
        }
      );
    } catch (acknowledgeError) {
      console.error(
        "Error acknowledging alert:",
        acknowledgeError
      );
      setError("Unable to acknowledge this alert. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingCount = alerts.filter(
    (alert) => !alert.acknowledged
  ).length;

  const acknowledgedCount = alerts.filter(
    (alert) => alert.acknowledged
  ).length;

  const highSeverityCount = alerts.filter(
    (alert) => alert.severity === "high"
  ).length;

  const filteredAlerts = alerts.filter((alert) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && !alert.acknowledged) ||
      (statusFilter === "acknowledged" && alert.acknowledged);

    const matchesSeverity =
      selectedSeverity === "all" ||
      alert.severity === selectedSeverity;

    return matchesStatus && matchesSeverity;
  });

  const summaryCards = [
    {
      label: "Total Alerts",
      value: alerts.length,
      color: colors.cyan,
    },
    {
      label: "Pending",
      value: pendingCount,
      color: "#fbbf24",
    },
    {
      label: "Acknowledged",
      value: acknowledgedCount,
      color: "#4ade80",
    },
    {
      label: "High Severity",
      value: highSeverityCount,
      color: "#f87171",
    },
  ];

  return (
    <main style={pageStyle}>
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <div>
            <p
              style={{
                color: colors.cyan,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Smart Spectacles
            </p>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 38px)",
                margin: "0 0 8px",
              }}
            >
              Alert History
            </h1>

            <p
              style={{
                color: colors.muted,
                fontSize: "14px",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Monitor, review, and acknowledge your recorded sensor alerts.
            </p>
          </div>

          <Link
            href="/dashboard"
            style={{
              ...buttonStyle,
              display: "inline-block",
              background: colors.cyan,
              borderColor: colors.cyan,
              color: "#06121f",
              textDecoration: "none",
            }}
          >
            ← Back to Dashboard
          </Link>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              ...cardStyle,
              color: "#fecaca",
              background: "#29151b",
              borderColor: "#7f1d1d",
            }}
          >
            {error}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {summaryCards.map((item) => (
            <div key={item.label} style={cardStyle}>
              <p
                style={{
                  color: colors.muted,
                  fontSize: "14px",
                  margin: "0 0 12px",
                }}
              >
                {item.label}
              </p>

              <p
                style={{
                  color: item.color,
                  fontSize: "32px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section style={cardStyle}>
          <h2 style={{ fontSize: "19px", marginTop: 0 }}>
            Filter Alerts
          </h2>

          <p
            style={{
              color: colors.muted,
              fontSize: "13px",
              marginBottom: "12px",
            }}
          >
            Status
          </p>

          <div
            aria-label="Filter alerts by status"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "22px",
            }}
          >
            <FilterButton
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All ({alerts.length})
            </FilterButton>

            <FilterButton
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
            >
              Needs review ({pendingCount})
            </FilterButton>

            <FilterButton
              active={statusFilter === "acknowledged"}
              onClick={() => setStatusFilter("acknowledged")}
            >
              Acknowledged ({acknowledgedCount})
            </FilterButton>
          </div>

          <p
            style={{
              color: colors.muted,
              fontSize: "13px",
              marginBottom: "12px",
            }}
          >
            Severity
          </p>

          <div
            aria-label="Filter alerts by severity"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <FilterButton
              active={selectedSeverity === "all"}
              onClick={() => setSelectedSeverity("all")}
            >
              All severities
            </FilterButton>

            <FilterButton
              active={selectedSeverity === "low"}
              onClick={() => setSelectedSeverity("low")}
            >
              Low
            </FilterButton>

            <FilterButton
              active={selectedSeverity === "medium"}
              onClick={() => setSelectedSeverity("medium")}
            >
              Medium
            </FilterButton>

            <FilterButton
              active={selectedSeverity === "high"}
              onClick={() => setSelectedSeverity("high")}
            >
              High
            </FilterButton>
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ fontSize: "22px", margin: 0 }}>
              Recorded Alerts
            </h2>

            <span
              style={{
                color: colors.muted,
                fontSize: "13px",
              }}
            >
              Showing {filteredAlerts.length} of {alerts.length}
            </span>
          </div>

          {loading ? (
            <div style={cardStyle}>
              <p style={{ color: colors.muted }}>
                Loading alerts...
              </p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div
              style={{
                ...cardStyle,
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <p
                style={{
                  color: colors.cyan,
                  fontSize: "32px",
                  margin: "0 0 12px",
                }}
              >
                ✓
              </p>

              <h3 style={{ margin: "0 0 8px" }}>
                No alerts found
              </h3>

              <p
                style={{
                  color: colors.muted,
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                No alerts match your selected filters.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const accent = severityColor(alert.severity);

              return (
                <article
                  key={alert.id}
                  style={{
                    ...cardStyle,
                    borderLeftWidth: "4px",
                    borderLeftStyle: "solid",
                    borderLeftColor: accent,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "18px",
                    }}
                  >
                    <div style={{ flex: "1 1 260px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          marginBottom: "12px",
                        }}
                      >
                        <span
                          style={{
                            color: accent,
                            background: "#071321",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: accent,
                            borderRadius: "20px",
                            padding: "5px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {alert.severity} severity
                        </span>

                        <span
                          style={{
                            color: alert.acknowledged
                              ? "#4ade80"
                              : "#fbbf24",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          {alert.acknowledged
                            ? "✓ Acknowledged"
                            : "● Pending"}
                        </span>
                      </div>

                      <h3
                        style={{
                          fontSize: "18px",
                          margin: "0 0 8px",
                          textTransform: "capitalize",
                        }}
                      >
                        {alert.sensor} alert
                      </h3>

                      <p
                        style={{
                          color: "#dbe5f1",
                          lineHeight: 1.6,
                          margin: "0 0 14px",
                        }}
                      >
                        {alert.message}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px 20px",
                          color: colors.muted,
                          fontSize: "13px",
                        }}
                      >
                        <span>
                          Reading:{" "}
                          <strong style={{ color: colors.text }}>
                            {alert.value === null
                              ? "Unavailable"
                              : alert.value}
                          </strong>
                        </span>

                        <span>
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </div>
                    </div>

                    {!alert.acknowledged && (
                      <button
                        type="button"
                        disabled={updatingId === alert.id}
                        onClick={() => acknowledgeAlert(alert.id)}
                        style={{
                          ...buttonStyle,
                          color: "#06121f",
                          background:
                            updatingId === alert.id
                              ? "#94a3b8"
                              : colors.cyan,
                          borderColor:
                            updatingId === alert.id
                              ? "#94a3b8"
                              : colors.cyan,
                          cursor:
                            updatingId === alert.id
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            updatingId === alert.id ? 0.7 : 1,
                        }}
                      >
                        {updatingId === alert.id
                          ? "Saving..."
                          : "Acknowledge"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <footer
          style={{
            textAlign: "center",
            color: colors.muted,
            fontSize: "12px",
            padding: "24px 0 8px",
          }}
        >
          Alert history updates automatically from Firebase.
        </footer>
      </div>
    </main>
  );
}
