"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTheme(current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cinovid-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Koyu temaya geç" : "Açık temaya geç"}
      title={theme === "light" ? "Koyu tema" : "Açık tema"}
    >
      <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
      <span className="theme-label">{theme === "light" ? "Koyu" : "Açık"}</span>
    </button>
  );
}
