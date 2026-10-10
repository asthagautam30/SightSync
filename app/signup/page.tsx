
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Your password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match. Please try again.");
      return;
    }

    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/profile");
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(error.code)
          : "";

      let friendlyMessage =
        "We couldn't create your account. Please try again.";

      if (code === "auth/email-already-in-use") {
        friendlyMessage =
          "An account already exists with this email. Try logging in instead.";
      } else if (code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (code === "auth/weak-password") {
        friendlyMessage =
          "Please choose a stronger password with at least 6 characters.";
      } else if (code === "auth/network-request-failed") {
        friendlyMessage =
          "Network error. Check your internet connection and try again.";
      } else if (code === "auth/operation-not-allowed") {
        friendlyMessage =
          "Email and password signup is not enabled in Firebase Authentication.";
      }

      setMessage(friendlyMessage);
      setLoading(false);
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
            START YOUR JOURNEY
          </div>

          <h1 style={styles.heroTitle}>
            A smarter way
            <br />
            to <span style={styles.gradientText}>stay aware.</span>
          </h1>

          <p style={styles.introText}>
            Create your Smart Spectacles account to access environmental
            monitoring, sensor history, safety alerts, and personalized
            settings.
          </p>

          <div style={styles.benefits}>
            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>📡</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Connected monitoring
                </strong>
                <p style={styles.benefitText}>
                  View sensor readings from your connected data source.
                </p>
              </div>
            </div>

            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>📈</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Insights over time
                </strong>
                <p style={styles.benefitText}>
                  Explore recorded readings and historical trends.
                </p>
              </div>
            </div>

            <div style={styles.benefit}>
              <span style={styles.benefitIcon}>🔔</span>
              <div>
                <strong style={styles.benefitTitle}>
                  Alerts in one place
                </strong>
                <p style={styles.benefitText}>
                  Review environmental warnings and acknowledge alerts.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.formCard}>
          <div style={styles.formIcon}>✨</div>

          <h2 style={styles.formTitle}>Create your account</h2>
          <p style={styles.formDescription}>
            Enter your details to get started.
          </p>

          <form onSubmit={handleSignup} style={styles.form}>
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
              <label htmlFor="password" style={styles.label}>
                Password
              </label>

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="confirmPassword" style={styles.label}>
                Confirm password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Enter your password again"
                style={styles.input}
                disabled={loading}
              />
            </div>

            <label style={styles.showPassword}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={loading}
              />
              Show passwords
            </label>

            {message && (
              <div
                role="alert"
                aria-live="polite"
                style={styles.errorMessage}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </form>

          <div style={styles.separator}>
            <span />
            <span style={styles.separatorText}>ALREADY REGISTERED?</span>
            <span />
          </div>

          <p style={styles.loginText}>
            Already have an account?{" "}
            <Link href="/login" style={styles.loginLink}>
              Sign in
            </Link>
          </p>

          <p style={styles.privacyNote}>
            🔒 Your account is managed by Firebase Authentication.
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
    right: "8%",
    background: "rgba(99,102,241,0.1)",
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
    padding: "60px 0 70px",
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
    fontSize: "clamp(42px, 5.5vw, 68px)",
    lineHeight: 1.08,
    letterSpacing: "-2.5px",
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
    margin: "0 0 30px",
  },
  benefits: {
    display: "flex",
    flexDirection: "column",
    gap: 21,
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
    padding: "32px",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(20,31,51,0.98), rgba(12,19,34,0.98))",
    boxShadow: "0 25px 80px rgba(0,0,0,0.28)",
  },
  formIcon: {
    display: "grid",
    placeItems: "center",
    width: 50,
    height: 50,
    borderRadius: 15,
    background: "rgba(103,232,249,0.1)",
    fontSize: 25,
    marginBottom: 20,
  },
  formTitle: {
    margin: "0 0 9px",
    fontSize: 25,
    lineHeight: 1.3,
    letterSpacing: "-0.8px",
  },
  formDescription: {
    margin: "0 0 25px",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.7,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 17,
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
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1323",
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  showPassword: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#94a3b8",
    fontSize: 12,
    cursor: "pointer",
  },
  errorMessage: {
    padding: 12,
    borderRadius: 9,
    color: "#fecaca",
    background: "rgba(127,29,29,0.25)",
    border: "1px solid rgba(248,113,113,0.3)",
    fontSize: 12,
    lineHeight: 1.7,
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
    marginTop: 2,
  },
  separator: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "26px 0 18px",
  },
  separatorText: {
    flexShrink: 0,
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.8px",
  },
  loginText: {
    textAlign: "center",
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
  },
  loginLink: {
    color: "#67e8f9",
    textDecoration: "none",
    fontWeight: 800,
  },
  privacyNote: {
    textAlign: "center",
    margin: "23px 0 0",
    paddingTop: 17,
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
