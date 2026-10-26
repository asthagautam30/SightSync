import Link from "next/link";

export default function GasAlertGuidePage() {
  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <Link href="/dashboard" style={styles.link}>← Back to Dashboard</Link>
        <h1 style={styles.title}>How to Set Gas Alert Limits</h1>
        <p style={styles.text}>
          The gas value shown by this project depends on the gas sensor or
          simulator and its configuration. A raw reading is not automatically a
          gas concentration in ppm.
        </p>
        <h2 style={styles.heading}>Choosing a value</h2>
        <ul style={styles.list}>
          <li>Start with the project&apos;s default value if you are unsure.</li>
          <li>Observe typical readings in your own setup.</li>
          <li>Choose a custom warning limit only after checking how the project&apos;s alert logic uses that reading.</li>
        </ul>
        <p style={styles.note}>
          Demo values are not calibrated gas measurements and must not be used
          as certified gas-safety limits.
        </p>
        <Link href="/dashboard" style={styles.button}>Done</Link>
      </article>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b1120", color: "#e5e7eb", padding: "32px 16px", fontFamily: "Arial, sans-serif" },
  card: { maxWidth: "760px", margin: "0 auto", background: "#111b2e", border: "1px solid #263449", borderRadius: "12px", padding: "24px" },
  link: { color: "#93c5fd", textDecoration: "none", fontSize: "14px" },
  title: { color: "#f9fafb", fontSize: "28px", margin: "24px 0 16px" },
  heading: { color: "#bfdbfe", fontSize: "18px", marginTop: "24px" },
  text: { lineHeight: 1.8, color: "#d1d5db" },
  list: { lineHeight: 1.9, color: "#d1d5db", paddingLeft: "22px" },
  note: { lineHeight: 1.8, color: "#fcd34d", background: "#292313", padding: "14px", borderRadius: "8px" },
  button: { display: "inline-block", marginTop: "16px", padding: "10px 16px", background: "#2563eb", color: "#fff", borderRadius: "8px", textDecoration: "none" },
};
