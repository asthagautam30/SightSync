
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">(
    "error"
  );
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      router.replace("/dashboard");
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(error.code)
          : "";

      let friendlyMessage =
        "We couldn't sign you in. Please try again.";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        friendlyMessage =
          "Incorrect email or password. Please check your details.";
      } else if (code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (code === "auth/too-many-requests") {
        friendlyMessage =
          "Too many attempts. Please wait a while before trying again.";
      } else if (code === "auth/network-request-failed") {
        friendlyMessage =
          "Network error. Check your internet connection and try again.";
      }

      setMessage(friendlyMessage);
      setMessageType("error");
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage("Enter your email address first to reset your password.");
      setMessageType("error");
      return;
    }

    setMessage("");
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage(
        "If an account exists for this email, a password reset email has been sent."
      );
      setMessageType("success");
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(error.code)
          : "";

      setMessage(
        code === "auth/invalid-email"
          ? "Please enter a valid email address."
          : "We couldn't send the reset email. Please check your email and try again."
      );
      setMessageType("error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <Link href="/" style={styles.brand}>
          <span style={styles.brandIcon}>👓</span>
          <span>Smart Spectacles</span>
        </Link>

        <Link href="/" style={styles.backLink}>
          ← Back to home
        </Link>
      </header>

      <section style={styles.layout}>
        <div style={styles.intro}>
          <div style={styles.eyebrow}>
            <span style={styles.eyebrowDot} />
            YOUR ENVIRONMENT, AT A GLANCE
          </div>

          <h1 style={styles.heroTitle}>
            Welcome
            <br />
            <span style={styles.gradientText}>back.</span>
          </h1>

          <p style={styles.introText}>
            Sign in to access your environmental monitoring dashboard,
            review sensor history, and manage your safety alerts.
          </p>

          <div style={styles.benefits}>
            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>📊</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Your sensor history
                </strong>
                <p style={styles.benefitText}>
                  Review recorded measurements and trends.
                </p>
              </div>
            </div>

            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>🔔</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Your safety alerts
                </strong>
                <p style={styles.benefitText}>
                  Check warnings and their acknowledgement status.
                </p>
              </div>
            </div>

            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>⚙️</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Your preferences
                </strong>
                <p style={styles.benefitText}>
                  Access your saved profile and settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.formCard}>
          <div style={styles.formIcon}>👋</div>

          <h2 style={styles.formTitle}>Sign in to your account</h2>

          <p style={styles.formDescription}>
            Enter your account details to continue.
          </p>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="email" style={styles.label}>
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <div style={styles.passwordHeader}>
                <label htmlFor="password" style={styles.label}>
                  Password
                </label>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={loading || resetLoading}
                  style={styles.forgotButton}
                >
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                style={styles.input}
                disabled={loading}
              />
            </div>

            {message && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  ...styles.message,
                  ...(messageType === "success"
                    ? styles.successMessage
                    : styles.errorMessage),
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || resetLoading}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <div style={styles.separator}>
            <span />
            <span style={styles.separatorText}>NEW TO SMART SPECTACLES?</span>
            <span />
          </div>

          <p style={styles.signupText}>
            Don't have an account?{" "}
            <Link href="/signup" style={styles.signupLink}>
              Create one
            </Link>
          </p>

          <p style={styles.privacyNote}>
            🔒 Your account is protected by Firebase Authentication.
          </p>
        </div>
      </section>

      <footer style={styles.footer}>
        © 2026 Smart Spectacles · Environmental awareness technology
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "0 28px",
    background: "#080d19",
    color: "#f8fafc",
    fontFamily: "Arial, Helvetica, sans-serif",
    overflow: "hidden",
  },
  backgroundGlow: {
    position: "absolute",
    width: 450,
    height: 450,
    top: 120,
    left: "10%",
    background: "rgba(34,211,238,0.08)",
    filter: "blur(100px)",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1180,
    margin: "0 auto",
    padding: "22px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#f8fafc",
    textDecoration: "none",
    fontSize: 18,
    fontWeight: 800,
  },
  brandIcon: {
    display: "grid",
    placeItems: "center",
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.25)",
    fontSize: 22,
  },
  backLink: {
    color: "#cbd5e1",
    fontSize: 13,
    textDecoration: "none",
  },
  layout: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1080,
    margin: "0 auto",
    padding: "65px 0 75px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    alignItems: "center",
    gap: 65,
  },
  intro: {
    maxWidth: 490,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid rgba(103,232,249,0.2)",
    background: "rgba(34,211,238,0.05)",
    color: "#a5f3fc",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1px",
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#67e8f9",
  },
  heroTitle: {
    margin: "25px 0 18px",
    fontSize: "clamp(48px, 6vw, 72px)",
    lineHeight: 1.04,
    letterSpacing: "-3px",
    fontWeight: 900,
  },
  gradientText: {
    background: "linear-gradient(100deg, #67e8f9, #818cf8)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  introText: {
    color: "#a7b3c7",
    fontSize: 15,
    lineHeight: 1.9,
    margin: "0 0 32px",
  },
  benefits: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  benefit: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  benefitIcon: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: 43,
    height: 43,
    borderRadius: 13,
    background: "rgba(103,232,249,0.09)",
    border: "1px solid rgba(103,232,249,0.14)",
    fontSize: 21,
  },
  benefitTitle: {
    display: "block",
    margin: "2px 0 6px",
    fontSize: 13,
    color: "#f1f5f9",
  },
  benefitText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.7,
  },
  formCard: {
    width: "100%",
    maxWidth: 450,
    justifySelf: "center",
    boxSizing: "border-box",
    padding: "35px 32px",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(20,31,51,0.98), rgba(12,19,34,0.98))",
    boxShadow: "0 25px 80px rgba(0,0,0,0.28)",
  },
  formIcon: {
    display: "grid",
    placeItems: "center",
    width: 52,
    height: 52,
    borderRadius: 16,
    background: "rgba(103,232,249,0.1)",
    fontSize: 26,
    marginBottom: 22,
  },
  formTitle: {
    margin: "0 0 9px",
    fontSize: 25,
    lineHeight: 1.3,
    letterSpacing: "-0.8px",
  },
  formDescription: {
    margin: "0 0 28px",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.7,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },
  label: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 700,
  },
  passwordHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  forgotButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#67e8f9",
    fontSize: 11,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 13px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1323",
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  message: {
    padding: 12,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 1.7,
  },
  errorMessage: {
    color: "#fecaca",
    background: "rgba(127,29,29,0.25)",
    border: "1px solid rgba(248,113,113,0.3)",
  },
  successMessage: {
    color: "#a7f3d0",
    background: "rgba(6,78,59,0.25)",
    border: "1px solid rgba(52,211,153,0.3)",
  },
  submitButton: {
    width: "100%",
    padding: "15px",
    border: "none",
    borderRadius: 10,
    background: "#67e8f9",
    color: "#06111f",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  separator: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "28px 0 18px",
  },
  separatorText: {
    flexShrink: 0,
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.8px",
  },
  signupText: {
    textAlign: "center",
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
  },
  signupLink: {
    color: "#67e8f9",
    textDecoration: "none",
    fontWeight: 800,
  },
  privacyNote: {
    textAlign: "center",
    margin: "24px 0 0",
    paddingTop: 18,
    borderTop: "1px solid rgba(148,163,184,0.12)",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.7,
  },
  footer: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1180,
    margin: "0 auto",
    padding: "20px 0 25px",
    borderTop: "1px solid rgba(148,163,184,0.12)",
    textAlign: "center",
    color: "#64748b",
    fontSize: 11,
  },
};
