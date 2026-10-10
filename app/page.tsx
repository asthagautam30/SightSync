
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onValue, ref } from "firebase/database";
import { realtimeDb } from "@/lib/firebase";

type ConnectionStatus = "connecting" | "connected" | "error";

const features = [
  {
    icon: "☀️",
    title: "UV Monitoring",
    description:
      "Monitor UV sensor readings and receive warnings when configured safety limits are exceeded.",
  },
  {
    icon: "🌫️",
    title: "Air Quality Monitoring",
    description:
      "Track gas and smoke sensor readings to help identify potentially concerning environmental conditions.",
  },
  {
    icon: "💡",
    title: "Light Monitoring",
    description:
      "Observe surrounding light levels and review historical measurements.",
  },
  {
    icon: "📊",
    title: "Historical Analytics",
    description:
      "Explore recorded sensor readings, trends, minimums, maximums, and averages.",
  },
  {
    icon: "🔔",
    title: "Smart Alerts",
    description:
      "Review recorded warnings, inspect their details, and acknowledge alerts.",
  },
  {
    icon: "👤",
    title: "Personalized Settings",
    description:
      "Keep your profile and preferences together for a personalized experience.",
  },
];

const steps = [
  {
    number: "01",
    title: "Monitor",
    description:
      "Sensors collect environmental measurements and send available readings to the system.",
  },
  {
    number: "02",
    title: "Analyze",
    description:
      "The application displays readings, records history, and checks configured warning flags.",
  },
  {
    number: "03",
    title: "Review",
    description:
      "Explore sensor trends and alerts to better understand the conditions around you.",
  },
];

export default function Home() {
  const [connection, setConnection] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const sensorRef = ref(realtimeDb, "smartSpectacles");

    const unsubscribe = onValue(
      sensorRef,
      () => {
        setConnection("connected");
      },
      (error) => {
        console.error("Firebase connection check failed:", error);
        setConnection("error");
      }
    );

    return () => unsubscribe();
  }, []);

  const connectionLabel =
    connection === "connected"
      ? "Connected"
      : connection === "error"
      ? "Unavailable"
      : "Connecting";

  return (
    <main style={styles.page}>
      <nav style={styles.nav}>
        <Link href="/" style={styles.brand}>
          <span style={styles.brandIcon}>👓</span>
          <span>Smart Spectacles</span>
        </Link>

        <div style={styles.navLinks}>
          <a href="#features" style={styles.navLink}>
            Features
          </a>
          <a href="#how-it-works" style={styles.navLink}>
            How it works
          </a>
          <Link href="/login" style={styles.loginButton}>
            Log in
          </Link>
          <Link href="/signup" style={styles.primaryButton}>
            Get Started →
          </Link>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            <span style={styles.liveDot} />
            ENVIRONMENTAL AWARENESS TECHNOLOGY
          </div>

          <h1 style={styles.heroTitle}>
            See your surroundings.
            <br />
            <span style={styles.gradientText}>
              Understand your safety.
            </span>
          </h1>

          <p style={styles.heroDescription}>
            Smart Spectacles brings environmental sensor monitoring,
            historical insights, and safety alerts together in one
            easy-to-use platform.
          </p>

          <div style={styles.heroActions}>
            <Link href="/signup" style={styles.heroPrimaryButton}>
              Get Started →
            </Link>
            <Link href="/login" style={styles.heroSecondaryButton}>
              I already have an account
            </Link>
          </div>

          <div style={styles.trustRow}>
            <span>✓ Live sensor monitoring</span>
            <span>✓ Personal dashboard</span>
            <span>✓ Historical insights</span>
          </div>
        </div>

        <div style={styles.previewWrap}>
          <div style={styles.previewGlow} />

          <div style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <div>
                <p style={styles.previewEyebrow}>YOUR ENVIRONMENT</p>
                <h2 style={styles.previewTitle}>
                  Monitoring overview
                </h2>
              </div>

              <span style={styles.previewBadge}>
                <span
                  style={{
                    ...styles.previewDot,
                    background:
                      connection === "connected"
                        ? "#34d399"
                        : connection === "error"
                        ? "#f87171"
                        : "#fbbf24",
                  }}
                />
                {connectionLabel}
              </span>
            </div>

            <div style={styles.previewStatus}>
              <div style={styles.statusIcon}>⌁</div>
              <div>
                <strong style={styles.statusHeading}>
                  {connection === "connected"
                    ? "Firebase is responding"
                    : connection === "error"
                    ? "Connection unavailable"
                    : "Checking connection"}
                </strong>
                <p style={styles.statusDescription}>
                  {connection === "connected"
                    ? "The application can read the sensor data location."
                    : connection === "error"
                    ? "Check your database connection and access rules."
                    : "Connecting to your sensor data source..."}
                </p>
              </div>
            </div>

            <div style={styles.previewMetrics}>
              {[
                { icon: "☀️", label: "UV sensor" },
                { icon: "🌫️", label: "Gas / Smoke" },
                { icon: "💡", label: "Light" },
                { icon: "📏", label: "Distance" },
              ].map((sensor) => (
                <div key={sensor.label} style={styles.metricCard}>
                  <span style={styles.metricIcon}>{sensor.icon}</span>
                  <span style={styles.metricLabel}>{sensor.label}</span>
                  <strong style={styles.metricValue}>Live data</strong>
                  <span style={styles.metricCaption}>
                    Reading status
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.previewFooter}>
              <span style={styles.footerIcon}>✦</span>
              <span>
                Your monitoring dashboard is available after login.
              </span>
            </div>
          </div>

          <div style={styles.floatingCard}>
            <span style={styles.floatingIcon}>📈</span>
            <div>
              <strong style={styles.floatingTitle}>
                Historical insights
              </strong>
              <p style={styles.floatingDescription}>
                Review recorded readings
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={styles.section}>
        <div style={styles.sectionHeading}>
          <span style={styles.sectionEyebrow}>
            BUILT FOR AWARENESS
          </span>
          <h2 style={styles.sectionTitle}>
            Everything you need to
            <br />
            <span style={styles.gradientText}>
              monitor your environment.
            </span>
          </h2>
          <p style={styles.sectionDescription}>
            One platform for sensor readings, recorded warnings,
            historical data, and personal preferences.
          </p>
        </div>

        <div style={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.title} style={styles.featureCard}>
              <div style={styles.featureIcon}>{feature.icon}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDescription}>
                {feature.description}
              </p>
              <span style={styles.featureArrow}>↗</span>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={styles.howSection}>
        <div style={styles.sectionHeading}>
          <span style={styles.sectionEyebrow}>
            SIMPLE BY DESIGN
          </span>
          <h2 style={styles.sectionTitle}>
            From sensor to insight.
          </h2>
          <p style={styles.sectionDescription}>
            Follow the journey from environmental measurements to
            information you can review.
          </p>
        </div>

        <div style={styles.stepsGrid}>
          {steps.map((step, index) => (
            <article key={step.number} style={styles.stepCard}>
              <div style={styles.stepTop}>
                <span style={styles.stepNumber}>{step.number}</span>
                {index < steps.length - 1 && (
                  <span style={styles.stepLine} />
                )}
              </div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDescription}>
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.ctaSection}>
        <div style={styles.ctaCard}>
          <div style={styles.ctaDecoration} />
          <span style={styles.sectionEyebrow}>
            YOUR ENVIRONMENT, AT A GLANCE
          </span>
          <h2 style={styles.ctaTitle}>
            Ready to explore Smart Spectacles?
          </h2>
          <p style={styles.ctaDescription}>
            Create your profile and access your personalized monitoring
            dashboard, sensor history, and alert records.
          </p>
          <div style={styles.ctaActions}>
            <Link href="/signup" style={styles.heroPrimaryButton}>
              Create Your Account →
            </Link>
            <Link href="/login" style={styles.ctaLoginLink}>
              Already registered? Log in
            </Link>
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <Link href="/" style={styles.footerBrand}>
          👓 Smart Spectacles
        </Link>
        <p style={styles.footerText}>
          Environmental awareness through connected sensing.
        </p>

        <div style={styles.footerLinks}>
          <Link href="/login" style={styles.footerLink}>
            Login
          </Link>
          <Link href="/signup" style={styles.footerLink}>
            Sign up
          </Link>
        </div>

        <p style={styles.copyright}>
          © 2026 Smart Spectacles. Built for environmental awareness.
        </p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#080d19",
    color: "#f8fafc",
    fontFamily: "Arial, Helvetica, sans-serif",
    overflowX: "hidden",
  },
  nav: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "22px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#f8fafc",
    textDecoration: "none",
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  brandIcon: {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    borderRadius: 13,
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.25)",
    fontSize: 23,
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 20,
    flexWrap: "wrap",
  },
  navLink: {
    color: "#a7b3c7",
    textDecoration: "none",
    fontSize: 14,
  },
  loginButton: {
    color: "#e2e8f0",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  primaryButton: {
    padding: "11px 17px",
    borderRadius: 10,
    color: "#06111f",
    background: "#67e8f9",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  hero: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "84px 28px 100px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
    alignItems: "center",
    gap: 56,
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 13px",
    borderRadius: 999,
    border: "1px solid rgba(103,232,249,0.24)",
    background: "rgba(34,211,238,0.06)",
    color: "#a5f3fc",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "1.1px",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#67e8f9",
  },
  heroTitle: {
    margin: "27px 0 20px",
    fontSize: "clamp(38px, 5vw, 66px)",
    lineHeight: 1.09,
    letterSpacing: "-2.7px",
    fontWeight: 900,
  },
  gradientText: {
    background: "linear-gradient(100deg, #67e8f9, #818cf8 85%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  heroDescription: {
    maxWidth: 560,
    color: "#a7b3c7",
    fontSize: 17,
    lineHeight: 1.8,
    margin: "0 0 28px",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
  },
  heroPrimaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "15px 21px",
    borderRadius: 11,
    background: "#67e8f9",
    color: "#06111f",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  heroSecondaryButton: {
    padding: "14px 18px",
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,0.28)",
    color: "#e2e8f0",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  trustRow: {
    marginTop: 30,
    display: "flex",
    flexWrap: "wrap",
    gap: "12px 20px",
    color: "#94a3b8",
    fontSize: 12,
  },
  previewWrap: {
    position: "relative",
    minWidth: 0,
  },
  previewGlow: {
    position: "absolute",
    inset: "10% 5%",
    background: "rgba(59,130,246,0.2)",
    filter: "blur(70px)",
    borderRadius: "50%",
  },
  previewCard: {
    position: "relative",
    padding: 23,
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(20,31,51,0.98), rgba(12,19,34,0.98))",
    boxShadow: "0 30px 100px rgba(0,0,0,0.3)",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  previewEyebrow: {
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.5px",
    margin: "0 0 8px",
  },
  previewTitle: {
    fontSize: 20,
    margin: 0,
    letterSpacing: "-0.5px",
  },
  previewBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 999,
    padding: "7px 10px",
    color: "#cbd5e1",
    fontSize: 11,
    background: "rgba(15,23,42,0.5)",
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
  },
  previewStatus: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: 16,
    marginTop: 23,
    borderRadius: 13,
    border: "1px solid rgba(103,232,249,0.16)",
    background: "rgba(34,211,238,0.05)",
  },
  statusIcon: {
    flexShrink: 0,
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "rgba(103,232,249,0.12)",
    color: "#67e8f9",
    fontSize: 30,
  },
  statusHeading: {
    fontSize: 13,
    color: "#f1f5f9",
  },
  statusDescription: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 1.6,
    margin: "5px 0 0",
  },
  previewMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 12,
    marginTop: 15,
  },
  metricCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 9,
    padding: 15,
    borderRadius: 13,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.55)",
  },
  metricIcon: {
    fontSize: 22,
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 11,
  },
  metricValue: {
    color: "#e2e8f0",
    fontSize: 14,
  },
  metricCaption: {
    color: "#64748b",
    fontSize: 10,
  },
  previewFooter: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid rgba(148,163,184,0.12)",
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.5,
  },
  footerIcon: {
    color: "#67e8f9",
    fontSize: 17,
  },
  floatingCard: {
    position: "absolute",
    right: -12,
    bottom: -25,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 17px",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 15,
    background: "#172338",
    boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
  },
  floatingIcon: {
    fontSize: 25,
  },
  floatingTitle: {
    fontSize: 12,
    color: "#f1f5f9",
  },
  floatingDescription: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: 10,
  },
  section: {
    padding: "88px 28px",
    background: "#f8fafc",
    color: "#0f172a",
  },
  sectionHeading: {
    maxWidth: 700,
    margin: "0 auto 42px",
    textAlign: "center",
  },
  sectionEyebrow: {
    display: "inline-block",
    marginBottom: 15,
    color: "#0891b2",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "1.5px",
  },
  sectionTitle: {
    margin: "0 0 16px",
    fontSize: "clamp(30px, 4vw, 45px)",
    lineHeight: 1.2,
    letterSpacing: "-1.6px",
    fontWeight: 900,
  },
  sectionDescription: {
    maxWidth: 590,
    margin: "0 auto",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.8,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 18,
    maxWidth: 1180,
    margin: "0 auto",
  },
  featureCard: {
    position: "relative",
    padding: 25,
    minHeight: 205,
    border: "1px solid #e2e8f0",
    borderRadius: 17,
    background: "white",
    boxShadow: "0 6px 22px rgba(15,23,42,0.035)",
  },
  featureIcon: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#ecfeff",
    fontSize: 25,
    marginBottom: 21,
  },
  featureTitle: {
    margin: "0 0 10px",
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: "-0.3px",
  },
  featureDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.8,
  },
  featureArrow: {
    position: "absolute",
    right: 22,
    top: 22,
    color: "#94a3b8",
    fontSize: 17,
  },
  howSection: {
    padding: "88px 28px 100px",
    background: "#eef5fb",
    color: "#0f172a",
  },
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
    gap: 22,
    maxWidth: 1100,
    margin: "0 auto",
  },
  stepCard: {
    padding: 25,
    borderRadius: 16,
    background: "white",
    border: "1px solid #e2e8f0",
  },
  stepTop: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    marginBottom: 25,
  },
  stepNumber: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#cffafe",
    color: "#0e7490",
    fontSize: 16,
    fontWeight: 900,
  },
  stepLine: {
    flex: 1,
    height: 1,
    background: "#cbd5e1",
  },
  stepTitle: {
    margin: "0 0 12px",
    fontSize: 20,
    fontWeight: 800,
  },
  stepDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.8,
  },
  ctaSection: {
    padding: "75px 28px",
    background: "#080d19",
  },
  ctaCard: {
    position: "relative",
    overflow: "hidden",
    maxWidth: 1100,
    margin: "0 auto",
    padding: "60px 28px",
    textAlign: "center",
    borderRadius: 24,
    border: "1px solid rgba(103,232,249,0.22)",
    background:
      "linear-gradient(135deg, rgba(14,116,144,0.16), rgba(79,70,229,0.14))",
  },
  ctaDecoration: {
    position: "absolute",
    width: 260,
    height: 260,
    top: -160,
    right: -50,
    borderRadius: "50%",
    background: "rgba(103,232,249,0.09)",
    filter: "blur(30px)",
  },
  ctaTitle: {
    position: "relative",
    maxWidth: 650,
    margin: "0 auto 17px",
    fontSize: "clamp(28px, 4vw, 43px)",
    letterSpacing: "-1.3px",
    lineHeight: 1.2,
  },
  ctaDescription: {
    position: "relative",
    maxWidth: 620,
    margin: "0 auto 28px",
    color: "#a7b3c7",
    fontSize: 15,
    lineHeight: 1.8,
  },
  ctaActions: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  ctaLoginLink: {
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: 13,
  },
  footer: {
    padding: "30px 28px 25px",
    borderTop: "1px solid rgba(148,163,184,0.13)",
    textAlign: "center",
  },
  footerBrand: {
    color: "#e2e8f0",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 16,
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 12,
    margin: "12px 0 18px",
  },
  footerLinks: {
    display: "flex",
    justifyContent: "center",
    gap: 20,
  },
  footerLink: {
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: 12,
  },
  copyright: {
    margin: "22px 0 0",
    color: "#64748b",
    fontSize: 11,
  },
};
