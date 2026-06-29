import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PasswordInputWithToggle } from "../components/PasswordInputWithToggle";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin/forms";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordPlainVisible, setPasswordPlainVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockUntilMs, setLockUntilMs] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!lockUntilMs) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockUntilMs - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs === 0) {
        setLockUntilMs(0);
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockUntilMs]);

  const lockCountdown = useMemo(() => {
    if (!remainingSeconds) return "";
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [remainingSeconds]);

  const isLocked = remainingSeconds > 0;

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLocked) return;
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLockUntilMs(0);
    } catch (err) {
      const retryAfterSeconds = Number(err?.body?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setLockUntilMs(Date.now() + retryAfterSeconds * 1000);
        setError("");
      } else {
        setLockUntilMs(0);
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card card-pad">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden>
            FS
          </div>
          <h1>Admin sign in</h1>
          <p className="muted">Use your configured admin email and password.</p>
        </div>
        {error ? (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
          </div>
        ) : null}
        {isLocked ? (
          <div className="alert" role="status">
            <span>
              Too many failed attempts. Please wait {lockCountdown} before next login attempt.
            </span>
          </div>
        ) : null}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-with-leading-icon">
              <span className="input-leading-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path
                    d="M3 7.5 12 13l9-5.5M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInputWithToggle
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="current-password"
              plainVisible={passwordPlainVisible}
              onTogglePlain={() => setPasswordPlainVisible((prev) => !prev)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading || isLocked}>
            {loading ? "Signing in…" : isLocked ? `Try again in ${lockCountdown}` : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
