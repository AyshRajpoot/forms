import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppShell({ children }) {
  const { isAuthenticated, logout } = useAuth();

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
          <nav className="shell-nav" aria-label="Main">
            <NavLink
              to="/"
              className="btn btn-ghost btn-sm"
              style={({ isActive }) => (isActive ? { color: "var(--color-primary)", fontWeight: 700 } : undefined)}
            >
              Home
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/admin/forms"
                  className="btn btn-ghost btn-sm"
                  style={({ isActive }) => (isActive ? { color: "var(--color-primary)", fontWeight: 700 } : undefined)}
                >
                  Forms
                </NavLink>
                <NavLink
                  to="/admin/forms/new"
                  className="btn btn-ghost btn-sm"
                  style={({ isActive }) => (isActive ? { color: "var(--color-primary)", fontWeight: 700 } : undefined)}
                >
                  New form
                </NavLink>
                <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                Admin login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
