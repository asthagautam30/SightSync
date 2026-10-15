
// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { db } from "@/lib/firebase";
// import { useAuth } from "../auth-provider";
// import { useTheme } from "../theme-provider";
// import type { ThemeName } from "../theme-provider";
// import {
//   doc,
//   getDoc,
//   setDoc,
//   serverTimestamp,
// } from "firebase/firestore";

// const inputStyle: React.CSSProperties = {
//   width: "100%",
//   padding: "13px 15px",
//   marginTop: "8px",
//   borderRadius: "10px",
//   border: "1px solid var(--border)",
//   background: "var(--background)",
//   color: "var(--foreground)",
//   fontSize: "14px",
//   lineHeight: 1.5,
//   boxSizing: "border-box",
//   transition: "border-color 160ms ease",
// };

// const labelStyle: React.CSSProperties = {
//   display: "block",
//   color: "var(--foreground)",
//   fontSize: "13px",
//   fontWeight: 700,
//   marginTop: "22px",
//   letterSpacing: "0.1px",
// };

// const sectionStyle: React.CSSProperties = {
//   padding: "clamp(20px, 4vw, 28px)",
//   border: "1px solid var(--border)",
//   borderRadius: "16px",
//   background: "var(--surface)",
//   color: "var(--foreground)",
//   marginBottom: "22px",
//   boxShadow: "0 3px 12px rgba(35, 40, 32, 0.035)",
// };

// const sectionDescriptionStyle: React.CSSProperties = {
//   color: "var(--muted-foreground)",
//   fontSize: "13px",
//   lineHeight: 1.7,
//   margin: "6px 0 0",
// };

// const headingStyle: React.CSSProperties = {
//   fontSize: "18px",
//   fontWeight: 700,
//   letterSpacing: "-0.25px",
//   margin: 0,
// };

// export default function ProfilePage() {
//   const router = useRouter();
//   const { user, loading: authLoading } = useAuth();

//   const [name, setName] = useState("");
//   const [age, setAge] = useState("");
//   const [region, setRegion] = useState("");
//   const [screenTime, setScreenTime] = useState("");
//   const [outdoorTime, setOutdoorTime] = useState("");
//   const [environment, setEnvironment] = useState("");
//   const [device, setDevice] = useState("");
//   const [sensitivity, setSensitivity] = useState("medium");
//   const [alertType, setAlertType] = useState("visual");

//   const [message, setMessage] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [loadingProfile, setLoadingProfile] = useState(true);

//   const { theme, setTheme, ready } = useTheme();

//   useEffect(() => {
//     // Wait until Firebase finishes checking the login session.
//     if (authLoading) return;

//     if (!user) {
//       setLoadingProfile(false);
//       router.replace("/login");
//       return;
//     }

//     let cancelled = false;

//     async function loadProfile() {
//       try {
//         const profileRef = doc(db, "users", user.uid);
//         const profileSnapshot = await getDoc(profileRef);

//         if (cancelled) return;

//         if (!profileSnapshot.exists()) {
//           setLoadingProfile(false);
//           return;
//         }

//         const data = profileSnapshot.data();
//         const profile = data.profile ?? {};
//         const preferences = data.preferences ?? {};

//         if (typeof profile.name === "string") {
//           setName(profile.name);
//         }

//         if (profile.age !== undefined && profile.age !== null) {
//           setAge(String(profile.age));
//         }

//         if (typeof profile.region === "string") {
//           setRegion(profile.region);
//         }

//         if (typeof profile.screenTime === "string") {
//           setScreenTime(profile.screenTime);
//         }

//         if (typeof profile.outdoorTime === "string") {
//           setOutdoorTime(profile.outdoorTime);
//         }

//         if (typeof profile.environment === "string") {
//           setEnvironment(profile.environment);
//         }

//         if (typeof profile.device === "string") {
//           setDevice(profile.device);
//         }

//         if (
//           preferences.warningSensitivity === "low" ||
//           preferences.warningSensitivity === "medium" ||
//           preferences.warningSensitivity === "high"
//         ) {
//           setSensitivity(preferences.warningSensitivity);
//         }

//         if (
//           preferences.alertType === "visual" ||
//           preferences.alertType === "sound" ||
//           preferences.alertType === "both"
//         ) {
//           setAlertType(preferences.alertType);
//         }
//       } catch (error) {
//         console.error("Profile loading failed:", error);

//         if (!cancelled) {
//           setMessage(
//             "We couldn't load your saved profile. You can retry by refreshing the page."
//           );
//         }
//       } finally {
//         if (!cancelled) {
//           setLoadingProfile(false);
//         }
//       }
//     }

//     void loadProfile();

//     return () => {
//       cancelled = true;
//     };
//   }, [user, authLoading, router]);

//   const handleSubmit = async (
//     e: React.FormEvent<HTMLFormElement>
//   ) => {
//     e.preventDefault();
//     setMessage("");

//     if (!user) {
//       setMessage("Please log in before setting up your profile.");
//       return;
//     }

//     if (!name.trim() || !region.trim()) {
//       setMessage("Please enter your name and region.");
//       return;
//     }

//     setLoading(true);

//     try {
//       await setDoc(
//         doc(db, "users", user.uid),
//         {
//           profile: {
//             name: name.trim(),
//             age: Number(age),
//             region: region.trim(),
//             screenTime,
//             outdoorTime,
//             environment,
//             device,
//           },
//           preferences: {
//             warningSensitivity: sensitivity,
//             alertType,
//           },
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true }
//       );

//       router.push("/dashboard");
//     } catch (error) {
//       console.error("Profile save failed:", error);

//       setMessage(
//         "We couldn't save your profile. Please check your connection and try again."
//       );

//       setLoading(false);
//     }
//   };

//   // Wait for authentication and profile loading to finish.
//   if (authLoading || loadingProfile) {
//     return (
//       <main
//         style={{
//           minHeight: "100vh",
//           display: "grid",
//           placeItems: "center",
//           padding: "24px",
//           background: "var(--background)",
//           color: "var(--foreground)",
//           fontFamily: "Arial, Helvetica, sans-serif",
//         }}
//       >
//         Loading your saved profile...
//       </main>
//     );
//   }

//   // Do not render the profile while redirecting a logged-out user.
//   if (!user) {
//     return null;
//   }

//   return (
//     <main
//       style={{
//         minHeight: "100vh",
//         padding: "36px 18px 60px",
//         background: "var(--background)",
//         color: "var(--foreground)",
//         fontFamily: "Arial, Helvetica, sans-serif",
//       }}
//     >
//       <div style={{ maxWidth: "760px", margin: "0 auto" }}>
//         <a
//           href="/"
//           style={{
//             display: "inline-flex",
//             alignItems: "center",
//             gap: "10px",
//             color: "var(--accent)",
//             textDecoration: "none",
//             fontSize: "15px",
//             fontWeight: 700,
//             marginBottom: "32px",
//           }}
//         >
//           <span style={{ fontSize: "25px" }}>👓</span>
//           Smart Spectacles
//         </a>

//         <div style={{ marginBottom: "30px" }}>
//           <div
//             style={{
//               display: "inline-block",
//               padding: "7px 12px",
//               border: "1px solid var(--border)",
//               borderRadius: "999px",
//               background: "var(--surface)",
//               color: "var(--accent)",
//               fontSize: "11px",
//               letterSpacing: "0.8px",
//               fontWeight: 700,
//               marginBottom: "16px",
//             }}
//           >
//             PERSONALIZE YOUR EXPERIENCE
//           </div>

//           <h1
//             style={{
//               fontSize: "clamp(32px, 5vw, 44px)",
//               lineHeight: 1.15,
//               letterSpacing: "-1.3px",
//               margin: "0 0 14px",
//               fontWeight: 750,
//             }}
//           >
//             Your{" "}
//             <span style={{ color: "var(--accent)" }}>profile</span>
//           </h1>

//           <p
//             style={{
//               color: "var(--muted-foreground)",
//               fontSize: "15px",
//               lineHeight: 1.85,
//               margin: 0,
//               maxWidth: "600px",
//             }}
//           >
//             Update your daily routine and alert preferences. Your
//             previously saved information is loaded automatically.
//           </p>
//         </div>

//         <form onSubmit={handleSubmit}>
//           <section style={sectionStyle}>
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "13px",
//                 paddingBottom: "18px",
//                 borderBottom: "1px solid var(--border)",
//               }}
//             >
//               <div
//                 style={{
//                   width: "44px",
//                   height: "44px",
//                   flexShrink: 0,
//                   display: "grid",
//                   placeItems: "center",
//                   borderRadius: "12px",
//                   background: "var(--background)",
//                   fontSize: "22px",
//                 }}
//               >
//                 👤
//               </div>

//               <div>
//                 <h2 style={headingStyle}>Personal information</h2>
//                 <p style={sectionDescriptionStyle}>
//                   Basic details for your account.
//                 </p>
//               </div>
//             </div>

//             <label style={labelStyle} htmlFor="name">
//               Full name
//             </label>
//             <input
//               id="name"
//               type="text"
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               placeholder="Enter your name"
//               autoComplete="name"
//               required
//               maxLength={100}
//               style={inputStyle}
//             />

//             <label style={labelStyle} htmlFor="age">
//               Age
//             </label>
//             <input
//               id="age"
//               type="number"
//               value={age}
//               onChange={(e) => setAge(e.target.value)}
//               required
//               min="1"
//               max="120"
//               step="1"
//               placeholder="Enter your age"
//               style={inputStyle}
//             />

//             <label style={labelStyle} htmlFor="region">
//               Region
//             </label>
//             <input
//               id="region"
//               type="text"
//               value={region}
//               onChange={(e) => setRegion(e.target.value)}
//               placeholder="Example: Haryana, India"
//               required
//               maxLength={150}
//               style={inputStyle}
//             />
//           </section>

//           <section style={sectionStyle}>
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "13px",
//                 paddingBottom: "18px",
//                 borderBottom: "1px solid var(--border)",
//               }}
//             >
//               <div
//                 style={{
//                   width: "44px",
//                   height: "44px",
//                   flexShrink: 0,
//                   display: "grid",
//                   placeItems: "center",
//                   borderRadius: "12px",
//                   background: "var(--background)",
//                   fontSize: "22px",
//                 }}
//               >
//                 🌤️
//               </div>

//               <div>
//                 <h2 style={headingStyle}>Daily routine</h2>
//                 <p style={sectionDescriptionStyle}>
//                   Help us understand your usual environment.
//                 </p>
//               </div>
//             </div>

//             <label style={labelStyle} htmlFor="screenTime">
//               Average daily screen time
//             </label>
//             <select
//               id="screenTime"
//               value={screenTime}
//               onChange={(e) => setScreenTime(e.target.value)}
//               required
//               style={inputStyle}
//             >
//               <option value="">Select screen time</option>
//               <option value="less-than-2">Less than 2 hours</option>
//               <option value="2-4">2–4 hours</option>
//               <option value="4-6">4–6 hours</option>
//               <option value="6-8">6–8 hours</option>
//               <option value="more-than-8">More than 8 hours</option>
//             </select>

//             <label style={labelStyle} htmlFor="outdoorTime">
//               Average outdoor time
//             </label>
//             <select
//               id="outdoorTime"
//               value={outdoorTime}
//               onChange={(e) => setOutdoorTime(e.target.value)}
//               required
//               style={inputStyle}
//             >
//               <option value="">Select outdoor time</option>
//               <option value="less-than-1">Less than 1 hour</option>
//               <option value="1-2">1–2 hours</option>
//               <option value="2-4">2–4 hours</option>
//               <option value="4-plus">More than 4 hours</option>
//             </select>

//             <label style={labelStyle} htmlFor="environment">
//               Typical environment
//             </label>
//             <select
//               id="environment"
//               value={environment}
//               onChange={(e) => setEnvironment(e.target.value)}
//               required
//               style={inputStyle}
//             >
//               <option value="">Select your environment</option>
//               <option value="mostly-indoor">Mostly indoors</option>
//               <option value="mostly-outdoor">Mostly outdoors</option>
//               <option value="mixed">Mixed indoor and outdoor</option>
//             </select>

//             <label style={labelStyle} htmlFor="device">
//               Most-used device
//             </label>
//             <select
//               id="device"
//               value={device}
//               onChange={(e) => setDevice(e.target.value)}
//               required
//               style={inputStyle}
//             >
//               <option value="">Select your device</option>
//               <option value="phone">Phone</option>
//               <option value="laptop">Laptop</option>
//               <option value="tablet">Tablet</option>
//               <option value="multiple">Multiple devices</option>
//             </select>
//           </section>

//           {/* Appearance Settings */}
//           <section style={sectionStyle}>
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "13px",
//                 paddingBottom: "18px",
//                 borderBottom: "1px solid var(--border)",
//                 marginBottom: "20px",
//               }}
//             >
//               <div
//                 style={{
//                   width: "44px",
//                   height: "44px",
//                   flexShrink: 0,
//                   display: "grid",
//                   placeItems: "center",
//                   borderRadius: "12px",
//                   background: "var(--background)",
//                   fontSize: "22px",
//                 }}
//               >
//                 ◐
//               </div>

//               <div>
//                 <h2 style={headingStyle}>Appearance</h2>
//                 <p style={sectionDescriptionStyle}>
//                   Choose a colour palette that suits your preference.
//                 </p>
//               </div>
//             </div>

//             <label
//               htmlFor="theme-select"
//               style={{ ...labelStyle, marginTop: 0 }}
//             >
//               Colour theme
//             </label>

//             <select
//               id="theme-select"
//               value={theme}
//               disabled={!ready}
//               onChange={(e) => setTheme(e.target.value as ThemeName)}
//               style={{
//                 ...inputStyle,
//                 cursor: ready ? "pointer" : "wait",
//                 opacity: ready ? 1 : 0.7,
//               }}
//             >
//               <option value="green-light">Soft Green — Light</option>
//               <option value="green-dark">Green Night — Dark</option>
//               <option value="peach-light">Warm Peach — Light</option>
//               <option value="peach-dark">Peach Night — Dark</option>
//               <option value="stone-light">Soft Stone — Light</option>
//               <option value="slate-dark">Slate Night — Dark</option>
//             </select>

//             <p
//               style={{
//                 color: "var(--muted-foreground)",
//                 fontSize: "12px",
//                 lineHeight: 1.7,
//                 marginTop: "12px",
//                 marginBottom: 0,
//               }}
//             >
//               Your selected theme is saved automatically in this browser.
//             </p>
//           </section>

//           <section style={sectionStyle}>
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "13px",
//                 paddingBottom: "18px",
//                 borderBottom: "1px solid var(--border)",
//               }}
//             >
//               <div
//                 style={{
//                   width: "44px",
//                   height: "44px",
//                   flexShrink: 0,
//                   display: "grid",
//                   placeItems: "center",
//                   borderRadius: "12px",
//                   background: "var(--background)",
//                   fontSize: "22px",
//                 }}
//               >
//                 🔔
//               </div>

//               <div>
//                 <h2 style={headingStyle}>Safety preferences</h2>
//                 <p style={sectionDescriptionStyle}>
//                   Choose how you prefer to receive warnings.
//                 </p>
//               </div>
//             </div>

//             <label style={labelStyle} htmlFor="sensitivity">
//               Alert Frequency
//             </label>
//             <select
//               id="sensitivity"
//               value={sensitivity}
//               onChange={(e) => setSensitivity(e.target.value)}
//               style={inputStyle}
//             >
//               <option value="low">Low — Fewer alerts</option>
//               <option value="medium">Medium — Balanced alerts</option>
//               <option value="high">High — More alerts</option>
//             </select>

//             <label style={labelStyle} htmlFor="alertType">
//               Alert preference
//             </label>
//             <select
//               id="alertType"
//               value={alertType}
//               onChange={(e) => setAlertType(e.target.value)}
//               style={inputStyle}
//             >
//               <option value="visual">Visual alerts</option>
//               <option value="sound">Sound alerts</option>
//               <option value="both">Visual and sound alerts</option>
//             </select>

//             <p
//               style={{
//                 color: "var(--muted-foreground)",
//                 fontSize: "12px",
//                 lineHeight: 1.8,
//                 margin: "14px 0 0",
//               }}
//             >
//               These are your preferences. Sensor warning limits are
//               configured separately and will not be silently changed.
//             </p>
//           </section>

//           {message && (
//             <div
//               role="alert"
//               style={{
//                 background: "var(--surface)",
//                 border: "1px solid var(--border)",
//                 borderLeft: "4px solid var(--focus-ring)",
//                 color: "var(--foreground)",
//                 borderRadius: "10px",
//                 padding: "14px 16px",
//                 fontSize: "14px",
//                 marginBottom: "18px",
//               }}
//             >
//               {message}
//             </div>
//           )}

//           <button
//             type="submit"
//             disabled={loading}
//             style={{
//               width: "100%",
//               padding: "15px 20px",
//               border: "1px solid var(--accent)",
//               borderRadius: "11px",
//               background: "var(--accent)",
//               color: "var(--accent-foreground)",
//               fontSize: "15px",
//               fontWeight: 700,
//               letterSpacing: "0.1px",
//               cursor: loading ? "not-allowed" : "pointer",
//               opacity: loading ? 0.7 : 1,
//               transition: "opacity 160ms ease",
//             }}
//           >
//             {loading ? "Saving your profile..." : "Save Profile & Continue →"}
//           </button>

//           <p
//             style={{
//               textAlign: "center",
//               color: "var(--muted-foreground)",
//               fontSize: "12px",
//               lineHeight: 1.7,
//               marginTop: "18px",
//             }}
//           >
//             Your profile is saved securely under your account.
//           </p>
//         </form>

//         <footer
//           style={{
//             textAlign: "center",
//             color: "var(--muted-foreground)",
//             fontSize: "12px",
//             marginTop: "34px",
//           }}
//         >
//           Smart Spectacles · Environmental Safety System
//         </footer>
//       </div>
//     </main>
//   );
// }


"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "../auth-provider";
import { useTheme } from "../theme-provider";
import type { ThemeName } from "../theme-provider";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  marginTop: "8px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "14px",
  lineHeight: 1.5,
  boxSizing: "border-box",
  transition: "border-color 160ms ease",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--foreground)",
  fontSize: "13px",
  fontWeight: 700,
  marginTop: "22px",
  letterSpacing: "0.1px",
};

const sectionStyle: React.CSSProperties = {
  padding: "clamp(20px, 4vw, 28px)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  background: "var(--surface)",
  color: "var(--foreground)",
  marginBottom: "22px",
  boxShadow: "0 3px 12px rgba(35, 40, 32, 0.035)",
};

const sectionDescriptionStyle: React.CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: "13px",
  lineHeight: 1.7,
  margin: "6px 0 0",
};

const headingStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: "-0.25px",
  margin: 0,
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [region, setRegion] = useState("");
  type LocationSuggestion = {
    label: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
    lat: number | null;
    lon: number | null;
  };
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const locationRequest = useRef<AbortController | null>(null);
  const [screenTime, setScreenTime] = useState("");
  const [outdoorTime, setOutdoorTime] = useState("");
  const [environment, setEnvironment] = useState("");
  const [device, setDevice] = useState("");
  const [sensitivity, setSensitivity] = useState("medium");
  const [alertType, setAlertType] = useState("visual");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const { theme, setTheme, ready } = useTheme();
  
  const chooseLocation = (place: LocationSuggestion) => {
    setRegion(place.label);
    setSelectedLocation(place);
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
    setLocationError("");
    setActiveSuggestion(-1);
  };

  useEffect(() => {
    const query = region.trim();

    if (!showLocationSuggestions || query.length < 2 || selectedLocation) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      setLocationError("");
      return;
    }

    const controller = new AbortController();
    locationRequest.current?.abort();
    locationRequest.current = controller;

    const timer = setTimeout(async () => {
      setLocationLoading(true);
      setLocationError("");

      try {
        const response = await fetch(
          `/api/locations?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Location search is temporarily unavailable."
          );
        }

        if (!controller.signal.aborted) {
          setLocationSuggestions(
            Array.isArray(data.results) ? data.results : []
          );
          setActiveSuggestion(-1);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        if (!controller.signal.aborted) {
          console.error("Location autocomplete failed:", error);
          setLocationSuggestions([]);
          setLocationError("Unable to search locations. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLocationLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [region, showLocationSuggestions, selectedLocation]);


  useEffect(() => {
    // Wait until Firebase finishes checking the login session.
    if (authLoading) return;

    if (!user) {
      setLoadingProfile(false);
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (cancelled) return;

        if (!profileSnapshot.exists()) {
          setLoadingProfile(false);
          return;
        }

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

        if (profile.regionDetails && typeof profile.regionDetails === "object") {
          const details = profile.regionDetails;
          if (typeof details.label === "string") {
            setSelectedLocation({
              label: details.label,
              city: typeof details.city === "string" ? details.city : "",
              state: typeof details.state === "string" ? details.state : "",
              country: typeof details.country === "string" ? details.country : "",
              countryCode: typeof details.countryCode === "string" ? details.countryCode : "",
              lat: typeof details.lat === "number" ? details.lat : null,
              lon: typeof details.lon === "number" ? details.lon : null,
            });
          }
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
  }, [user, authLoading, router]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setMessage("");

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
            ...(selectedLocation?.label === region.trim()
              ? { regionDetails: selectedLocation }
              : {}),
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

  // Wait for authentication and profile loading to finish.
  if (authLoading || loadingProfile) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "var(--background)",
          color: "var(--foreground)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        Loading your saved profile...
      </main>
    );
  }

  // Do not render the profile while redirecting a logged-out user.
  if (!user) {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "36px 18px 60px",
        background: "var(--background)",
        color: "var(--foreground)",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--accent)",
            textDecoration: "none",
            fontSize: "15px",
            fontWeight: 700,
            marginBottom: "32px",
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
              border: "1px solid var(--border)",
              borderRadius: "999px",
              background: "var(--surface)",
              color: "var(--accent)",
              fontSize: "11px",
              letterSpacing: "0.8px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            PERSONALIZE YOUR EXPERIENCE
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 44px)",
              lineHeight: 1.15,
              letterSpacing: "-1.3px",
              margin: "0 0 14px",
              fontWeight: 750,
            }}
          >
            Your{" "}
            <span style={{ color: "var(--accent)" }}>profile</span>
          </h1>

          <p
            style={{
              color: "var(--muted-foreground)",
              fontSize: "15px",
              lineHeight: 1.85,
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
                gap: "13px",
                paddingBottom: "18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background: "var(--background)",
                  fontSize: "22px",
                }}
              >
                👤
              </div>

              <div>
                <h2 style={headingStyle}>Personal information</h2>
                <p style={sectionDescriptionStyle}>
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
            <div style={{ position: "relative" }}>
              <input
                id="region"
                type="text"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setSelectedLocation(null);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => {
                  if (region.trim().length >= 2 && !selectedLocation) {
                    setShowLocationSuggestions(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (!showLocationSuggestions || locationSuggestions.length === 0) {
                    if (e.key === "Escape") setShowLocationSuggestions(false);
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestion((current) =>
                      Math.min(current + 1, locationSuggestions.length - 1)
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestion((current) => Math.max(current - 1, 0));
                  } else if (e.key === "Enter" && activeSuggestion >= 0) {
                    e.preventDefault();
                    chooseLocation(locationSuggestions[activeSuggestion]);
                  } else if (e.key === "Escape") {
                    setShowLocationSuggestions(false);
                  }
                }}
                placeholder="Start typing a city or region"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showLocationSuggestions && locationSuggestions.length > 0}
                aria-controls="region-suggestions"
                aria-activedescendant={
                  activeSuggestion >= 0 ? `region-option-${activeSuggestion}` : undefined
                }
                required
                maxLength={150}
                style={inputStyle}
              />

              {showLocationSuggestions && region.trim().length >= 2 && (
                <div
                  id="region-suggestions"
                  role="listbox"
                  aria-label="Location suggestions"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 5px)",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    maxHeight: "240px",
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}
                >
                  {locationLoading && (
                    <div style={{ padding: "12px 14px", fontSize: "13px", color: "var(--muted-foreground)" }}>
                      Searching locations...
                    </div>
                  )}
                  {!locationLoading && locationError && (
                    <div role="status" style={{ padding: "12px 14px", fontSize: "13px", color: "var(--muted-foreground)" }}>
                      {locationError}
                    </div>
                  )}
                  {!locationLoading && !locationError && locationSuggestions.length === 0 && (
                    <div role="status" style={{ padding: "12px 14px", fontSize: "13px", color: "var(--muted-foreground)" }}>
                      No matching locations found.
                    </div>
                  )}
                  {locationSuggestions.map((place, index) => (
                    <button
                      key={`${place.label}-${place.lat ?? ""}-${place.lon ?? ""}`}
                      id={`region-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeSuggestion === index}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseLocation(place)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        border: "none",
                        borderBottom: index < locationSuggestions.length - 1 ? "1px solid var(--border)" : "none",
                        background: activeSuggestion === index ? "var(--background)" : "transparent",
                        color: "var(--foreground)",
                        textAlign: "left",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "block", fontWeight: 600 }}>{place.label}</span>
                      <span style={{ display: "block", marginTop: "3px", color: "var(--muted-foreground)", fontSize: "12px" }}>
                        {[place.city, place.state, place.country].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", lineHeight: 1.6, margin: "8px 0 0" }}>
              Type at least 2 characters and select a suggestion to save its location details.
            </p>
          </section>

          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "13px",
                paddingBottom: "18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background: "var(--background)",
                  fontSize: "22px",
                }}
              >
                🌤️
              </div>

              <div>
                <h2 style={headingStyle}>Daily routine</h2>
                <p style={sectionDescriptionStyle}>
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

          {/* Appearance Settings */}
          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "13px",
                paddingBottom: "18px",
                borderBottom: "1px solid var(--border)",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background: "var(--background)",
                  fontSize: "22px",
                }}
              >
                ◐
              </div>

              <div>
                <h2 style={headingStyle}>Appearance</h2>
                <p style={sectionDescriptionStyle}>
                  Choose a colour palette that suits your preference.
                </p>
              </div>
            </div>

            <label
              htmlFor="theme-select"
              style={{ ...labelStyle, marginTop: 0 }}
            >
              Colour theme
            </label>

            <select
              id="theme-select"
              value={theme}
              disabled={!ready}
              onChange={(e) => setTheme(e.target.value as ThemeName)}
              style={{
                ...inputStyle,
                cursor: ready ? "pointer" : "wait",
                opacity: ready ? 1 : 0.7,
              }}
            >
              <option value="green-light">Soft Green — Light</option>
              <option value="green-dark">Green Night — Dark</option>
              <option value="peach-light">Warm Peach — Light</option>
              <option value="peach-dark">Peach Night — Dark</option>
              <option value="stone-light">Soft Stone — Light</option>
              <option value="slate-dark">Slate Night — Dark</option>
            </select>

            <p
              style={{
                color: "var(--muted-foreground)",
                fontSize: "12px",
                lineHeight: 1.7,
                marginTop: "12px",
                marginBottom: 0,
              }}
            >
              Your selected theme is saved automatically in this browser.
            </p>
          </section>

          <section style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "13px",
                paddingBottom: "18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background: "var(--background)",
                  fontSize: "22px",
                }}
              >
                🔔
              </div>

              <div>
                <h2 style={headingStyle}>Safety preferences</h2>
                <p style={sectionDescriptionStyle}>
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
                color: "var(--muted-foreground)",
                fontSize: "12px",
                lineHeight: 1.8,
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
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "4px solid var(--focus-ring)",
                color: "var(--foreground)",
                borderRadius: "10px",
                padding: "14px 16px",
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
              border: "1px solid var(--accent)",
              borderRadius: "11px",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.1px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 160ms ease",
            }}
          >
            {loading ? "Saving your profile..." : "Save Profile & Continue →"}
          </button>

          <p
            style={{
              textAlign: "center",
              color: "var(--muted-foreground)",
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
            color: "var(--muted-foreground)",
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
