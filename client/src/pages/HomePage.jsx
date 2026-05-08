import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="stack">
      <section className="home-hero card card-pad">
        <p className="page-hero-kicker">Form Studio</p>
        <h1 className="page-hero-title">Professional dynamic form management</h1>
        <p className="page-hero-lead">
          Create forms, manage fields, and control active/inactive status in a clean workflow.
        </p>
        <div className="row-actions" style={{ marginTop: "1rem" }}>
          <Link className="btn btn-primary" to={isAuthenticated ? "/admin/forms" : "/login"}>
            {isAuthenticated ? "Go to forms" : "Admin login"}
          </Link>
          <Link className="btn btn-secondary" to="/admin/forms/new">
            Create new form
          </Link>
        </div>
      </section>

      <section className="home-grid">
        <article className="card card-pad">
          <h2 className="card-title">Step 1: Create form</h2>
          <p className="muted">Only form name is needed. Form key is generated automatically in background.</p>
        </article>
        <article className="card card-pad">
          <h2 className="card-title">Step 2: Add fields</h2>
          <p className="muted">Enter field labels and types. Field keys are auto-generated from labels.</p>
        </article>
        <article className="card card-pad">
          <h2 className="card-title">Step 3: Toggle active</h2>
          <p className="muted">Use instant toggles for forms and fields without screen jump.</p>
        </article>
      </section>
    </div>
  );
}
