import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ThemeIcon({ mode }) {
  if (mode === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-icon">
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2.7v2.1M12 19.2v2.1M2.7 12h2.1M19.2 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-icon">
        <path
          d="M20 14.1A8.8 8.8 0 1 1 9.9 4a7.5 7.5 0 1 0 10.1 10.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-icon">
      <rect x="3.2" y="4.2" width="17.6" height="11.8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.3 19.7h5.4M12 16.3v3.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-icon">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppShell({ children }) {
  const { isAuthenticated, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function cycleThemeMode() {
    const sequence = ["system", "dark", "light"];
    const currentIndex = sequence.indexOf(themeMode);
    const nextMode = sequence[(currentIndex + 1) % sequence.length];
    setThemeMode(nextMode);
  }

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to={isAuthenticated ? "/admin/forms" : "/"} className="brand">
            <span className="brand-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  d="M6 8h12M6 12h8M6 16h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Form Studio
          </Link>
          <nav className={`shell-nav ${isMobileMenuOpen ? "shell-nav-open" : ""}`} aria-label="Main">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `btn btn-ghost btn-sm shell-nav-link${isActive ? " shell-nav-link-active" : ""}`
              }
              onClick={closeMobileMenu}
            >
              Home
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/admin/forms"
                  className={({ isActive }) =>
                    `btn btn-ghost btn-sm shell-nav-link${isActive ? " shell-nav-link-active" : ""}`
                  }
                  onClick={closeMobileMenu}
                >
                  Forms
                </NavLink>
                <NavLink
                  to="/admin/forms/new"
                  className={({ isActive }) =>
                    `btn btn-ghost btn-sm shell-nav-link${isActive ? " shell-nav-link-active" : ""}`
                  }
                  onClick={closeMobileMenu}
                >
                  New form
                </NavLink>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    closeMobileMenu();
                    void logout();
                  }}
                >
                  Sign out
                </button>
                {isMobileViewport ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shell-nav-link shell-theme-menu-btn"
                    onClick={() => {
                      cycleThemeMode();
                      closeMobileMenu();
                    }}
                    title={`Theme: ${themeMode}`}
                    aria-label={`Switch theme mode. Current mode is ${themeMode}`}
                  >
                    <span aria-hidden className="theme-toggle-icon-wrap">
                      <ThemeIcon mode={themeMode} />
                    </span>
                    Theme
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary btn-sm" onClick={closeMobileMenu}>
                  Admin login
                </Link>
                {isMobileViewport ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shell-nav-link shell-theme-menu-btn"
                    onClick={() => {
                      cycleThemeMode();
                      closeMobileMenu();
                    }}
                    title={`Theme: ${themeMode}`}
                    aria-label={`Switch theme mode. Current mode is ${themeMode}`}
                  >
                    <span aria-hidden className="theme-toggle-icon-wrap">
                      <ThemeIcon mode={themeMode} />
                    </span>
                    Theme
                  </button>
                ) : null}
              </>
            )}
          </nav>
          <div className="shell-header-right">
            {isMobileViewport ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm shell-nav-link theme-toggle-btn shell-mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                title="Menu"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span aria-hidden className="theme-toggle-icon-wrap">
                  <MenuIcon />
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm shell-nav-link theme-toggle-btn"
              onClick={cycleThemeMode}
              title={`Theme: ${themeMode}`}
              aria-label={`Switch theme mode. Current mode is ${themeMode}`}
            >
              <span aria-hidden className="theme-toggle-icon-wrap">
                <ThemeIcon mode={themeMode} />
              </span>
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
