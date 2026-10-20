import Link from "next/link";

export default function DistanceAlertGuidePage() {
  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <Link href="/dashboard" style={styles.link}>← Back to Dashboard</Link>
        <h1 style={styles.title}>How to Set Viewing Distance Limits</h1>
        <p style={styles.text}>
          Viewing distance is measured from the sensor or estimated by your
          system. In this project, the displayed distance unit is centimetres
          (cm), unless your existing UI converts it to another unit.
        </p>
        <h2 style={styles.heading}>Choosing a value</h2>
        <ul style={styles.list}>
          <li>Start with the project's default value if you are unsure.</li>
          <li>Measure or observe the distance readings in the setup you are demonstrating.</li>
          <li>Choose a custom limit that matches your intended use and the direction of the existing alert logic.</li>
        </ul>
        <p style={styles.note}>
          A distance setting is a project preference, not a medical recommendation.
          Confirm how the sensor and alert logic interpret the value.
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
