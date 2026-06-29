import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "themeMode";
const ThemeContext = createContext(null);

function applyFavicon(theme) {
  if (typeof document === "undefined") return;
  const href = theme === "dark" ? "/favicon-dark.svg" : "/favicon-light.svg";
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    link.setAttribute("type", "image/svg+xml");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode) {
  return mode === "system" ? getSystemTheme() : mode;
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(themeMode));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(nextMode) {
      const nextResolved = resolveTheme(nextMode);
      setResolvedTheme(nextResolved);
      document.documentElement.setAttribute("data-theme", nextResolved);
      applyFavicon(nextResolved);
    }

    apply(themeMode);

    const onSystemThemeChange = () => {
      if (themeMode === "system") {
        apply("system");
      }
    };

    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode: (mode) => {
        if (!["light", "dark", "system"].includes(mode)) return;
        localStorage.setItem(THEME_STORAGE_KEY, mode);
        setThemeMode(mode);
      },
    }),
    [themeMode, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
