
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  marginTop: "8px",
  borderRadius: "10px",
  border: "1px solid #263b55",
  background: "#0b1729",
  color: "#f1f5f9",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#dbe5f3",
  fontSize: "13px",
  fontWeight: 600,
  marginTop: "20px",
};

const sectionStyle: React.CSSProperties = {
  padding: "22px",
  border: "1px solid #20344c",
  borderRadius: "16px",
  background: "rgba(15, 30, 49, 0.72)",
  marginBottom: "20px",
};

export default function ProfilePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [region, setRegion] = useState("");
  const [screenTime, setScreenTime] = useState("");
  const [outdoorTime, setOutdoorTime] = useState("");
  const [environment, setEnvironment] = useState("");
  const [device, setDevice] = useState("");
  const [sensitivity, setSensitivity] = useState("medium");
  const [alertType, setAlertType] = useState("visual");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const user = auth.currentUser;

      if (!user) {
        if (!cancelled) {
          setLoadingProfile(false);
          router.replace("/login");
        }
        return;
      }

      try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (cancelled || !profileSnapshot.exists()) return;

        const data = profileSnapshot.data();
        const profile = data.profile ?? {};
        const preferences = data.preferences ?? {};

        if (typeof profile.name === "string") {
          setName(profile.name);
        }
        if (profile.age !== undefined && profile.age !== null) {
        setAge(String(profile.age));
        }
        if (typeof profile.region === "string") {
          setRegion(profile.region);
        }
        if (typeof profile.screenTime === "string") {
          setScreenTime(profile.screenTime);
        }
        if (typeof profile.outdoorTime === "string") {
          setOutdoorTime(profile.outdoorTime);
        }
        if (typeof profile.environment === "string") {
          setEnvironment(profile.environment);
        }
        if (typeof profile.device === "string") {
          setDevice(profile.device);
        }
        if (
          preferences.warningSensitivity === "low" ||
          preferences.warningSensitivity === "medium" ||
          preferences.warningSensitivity === "high"
        ) {
          setSensitivity(preferences.warningSensitivity);
        }
        if (
          preferences.alertType === "visual" ||
          preferences.alertType === "sound" ||
          preferences.alertType === "both"
        ) {
          setAlertType(preferences.alertType);
        }
      } catch (error) {
        console.error("Profile loading failed:", error);

        if (!cancelled) {
          setMessage(
            "We couldn't load your saved profile. You can retry by refreshing the page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setMessage("");

    const user = auth.currentUser;

    if (!user) {
      setMessage("Please log in before setting up your profile.");
      return;
    }

    if (!name.trim() || !region.trim()) {
      setMessage("Please enter your name and region.");
      return;
    }

    setLoading(true);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          profile: {
            name: name.trim(),
            age: Number(age),
            region: region.trim(),
            screenTime,
            outdoorTime,
            environment,
            device,
          },
          preferences: {
            warningSensitivity: sensitivity,
            alertType,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push("/dashboard");
    } catch (error) {
      console.error("Profile save failed:", error);
      setMessage(
        "We couldn't save your profile. Please check your connection and try again."
      );
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background:
            "radial-gradient(ellipse at top, #132b43 0%, #08111f 48%, #050b14 100%)",
          color: "#67e8f9",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        Loading your saved profile...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "36px 18px 60px",
        background:
          "radial-gradient(ellipse at top, #132b43 0%, #08111f 48%, #050b14 100%)",
        color: "#f1f5f9",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            color: "#67e8f9",
            textDecoration: "none",
            fontSize: "15px",
            fontWeight: 700,
            marginBottom: "30px",
          }}
        >
          <span style={{ fontSize: "25px" }}>👓</span>
          Smart Spectacles
        </a>

        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 12px",
              border: "1px solid #164e63",
              borderRadius: "999px",
              background: "#082f3b",
              color: "#67e8f9",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            PERSONALIZE YOUR EXPERIENCE
          </div>

          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 42px)",
              lineHeight: 1.15,
              letterSpacing: "-1px",
              margin: "0 0 12px",
            }}
          >
            Your{" "}
            <span style={{ color: "#67e8f9" }}>profile</span>
          </h1>

          <p
            style={{
              color: "#9aabc0",
              fontSize: "15px",
              lineHeight: 1.8,
              margin: 0,
              maxWidth: "600px",
            }}
          >
            Update your daily routine and alert preferences. Your
            previously saved information is loaded automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "24px" }}>👤</div>
              <div>
                <h2 style={{ fontSize: "18px", margin: 0 }}>
                  Personal information
                </h2>
                <p
                  style={{
                    color: "#8fa2b9",
                    fontSize: "13px",
                    margin: "6px 0 0",
                  }}
                >
                  Basic details for your account.
                </p>
              </div>
            </div>

            <label style={labelStyle} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              required
              maxLength={100}
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="age">
  Age
</label>
<input
  id="age"
  type="number"
  value={age}
  onChange={(e) => setAge(e.target.value)}
  required
  min="1"
  max="120"
  step="1"
  placeholder="Enter your age"
  style={inputStyle}
/>

            <label style={labelStyle} htmlFor="region">
              Region
            </label>
            <input
              id="region"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Example: Haryana, India"
              required
              maxLength={150}
              style={inputStyle}
            />
          </section>

          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "24px" }}>🌤️</div>
              <div>
                <h2 style={{ fontSize: "18px", margin: 0 }}>
                  Daily routine
                </h2>
                <p
                  style={{
                    color: "#8fa2b9",
                    fontSize: "13px",
                    margin: "6px 0 0",
                  }}
                >
                  Help us understand your usual environment.
                </p>
              </div>
            </div>

            <label style={labelStyle} htmlFor="screenTime">
              Average daily screen time
            </label>
            <select
              id="screenTime"
              value={screenTime}
              onChange={(e) => setScreenTime(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select screen time</option>
              <option value="less-than-2">Less than 2 hours</option>
              <option value="2-4">2–4 hours</option>
              <option value="4-6">4–6 hours</option>
              <option value="6-8">6–8 hours</option>
              <option value="more-than-8">More than 8 hours</option>
            </select>

            <label style={labelStyle} htmlFor="outdoorTime">
              Average outdoor time
            </label>
            <select
              id="outdoorTime"
              value={outdoorTime}
              onChange={(e) => setOutdoorTime(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select outdoor time</option>
              <option value="less-than-1">Less than 1 hour</option>
              <option value="1-2">1–2 hours</option>
              <option value="2-4">2–4 hours</option>
              <option value="4-plus">More than 4 hours</option>
            </select>

            <label style={labelStyle} htmlFor="environment">
              Typical environment
            </label>
            <select
              id="environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select your environment</option>
              <option value="mostly-indoor">Mostly indoors</option>
              <option value="mostly-outdoor">Mostly outdoors</option>
              <option value="mixed">Mixed indoor and outdoor</option>
            </select>

            <label style={labelStyle} htmlFor="device">
              Most-used device
            </label>
            <select
              id="device"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select your device</option>
              <option value="phone">Phone</option>
              <option value="laptop">Laptop</option>
              <option value="tablet">Tablet</option>
              <option value="multiple">Multiple devices</option>
            </select>
          </section>

          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "24px" }}>🔔</div>
              <div>
                <h2 style={{ fontSize: "18px", margin: 0 }}>
                  Safety preferences
                </h2>
                <p
                  style={{
                    color: "#8fa2b9",
                    fontSize: "13px",
                    margin: "6px 0 0",
                  }}
                >
                  Choose how you prefer to receive warnings.
                </p>
              </div>
            </div>

            <label style={labelStyle} htmlFor="sensitivity">
  Alert Frequency
</label>
<select
  id="sensitivity"
  value={sensitivity}
  onChange={(e) => setSensitivity(e.target.value)}
  style={inputStyle}
>
  <option value="low">Low — Fewer alerts</option>
  <option value="medium">Medium — Balanced alerts</option>
  <option value="high">High — More alerts</option>
</select>

            <label style={labelStyle} htmlFor="alertType">
              Alert preference
            </label>
            <select
              id="alertType"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              style={inputStyle}
            >
              <option value="visual">Visual alerts</option>
              <option value="sound">Sound alerts</option>
              <option value="both">Visual and sound alerts</option>
            </select>

            <p
              style={{
                color: "#8296ad",
                fontSize: "12px",
                lineHeight: 1.7,
                margin: "14px 0 0",
              }}
            >
              These are your preferences. Sensor warning limits are
              configured separately and will not be silently changed.
            </p>
          </section>

          {message && (
            <div
              role="alert"
              style={{
                background: "#3a1720",
                border: "1px solid #7f2938",
                color: "#fecdd3",
                borderRadius: "10px",
                padding: "13px 15px",
                fontSize: "14px",
                marginBottom: "18px",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px 20px",
              border: "none",
              borderRadius: "11px",
              background: loading ? "#27798a" : "#67e8f9",
              color: "#07111e",
              fontSize: "15px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 8px 28px rgba(34, 211, 238, 0.12)",
            }}
          >
            {loading ? "Saving your profile..." : "Save Profile & Continue →"}
          </button>

          <p
            style={{
              textAlign: "center",
              color: "#71839a",
              fontSize: "12px",
              lineHeight: 1.7,
              marginTop: "18px",
            }}
          >
            Your profile is saved securely under your account.
          </p>
        </form>

        <footer
          style={{
            textAlign: "center",
            color: "#5f7187",
            fontSize: "12px",
            marginTop: "34px",
          }}
        >
          Smart Spectacles · Environmental Safety System
        </footer>
      </div>
    </main>
  );
}
