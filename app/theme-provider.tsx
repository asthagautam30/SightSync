"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemeName =
  | "green-light"
  | "green-dark"
  | "peach-light"
  | "peach-dark"
  | "stone-light"
  | "slate-dark";

type ThemeContextType = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

const validThemes: ThemeName[] = [
  "green-light",
  "green-dark",
  "peach-light",
  "peach-dark",
  "stone-light",
  "slate-dark",
];

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] =
    useState<ThemeName>("green-light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smart-spectacles-theme");

      if (saved && validThemes.includes(saved as ThemeName)) {
        setThemeState(saved as ThemeName);
      }
    } catch {
      // Continue with the default theme.
    }

    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    if (ready) {
      try {
        localStorage.setItem("smart-spectacles-theme", theme);
      } catch {
        // The theme still works for the current session.
      }
    }
  }, [theme, ready]);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    if (validThemes.includes(nextTheme)) {
      setThemeState(nextTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}