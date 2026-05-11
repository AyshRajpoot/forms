import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { CustomDialog } from "../components/CustomDialog";

export function AdminFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/admin/forms");
      setForms(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleFormActive(form) {
    setError("");
    setTogglingId(form._id);
    try {
      const nextActive = !form.isActive;
      await api(`/api/admin/forms/${form._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      setForms((prev) =>
        prev.map((item) =>
          item._id === form._id ? { ...item, isActive: nextActive, updatedAt: new Date().toISOString() } : item
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDeleteForm() {
    if (!pendingDelete?.id) return;
    setError("");
    setDeleting(true);
    try {
      await api(`/api/admin/forms/${pendingDelete.id}`, { method: "DELETE" });
      await load();
      setToast("Form deleted successfully");
      setTimeout(() => setToast(""), 2200);
      setPendingDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="stack">
      {toast ? <div className="floating-toast">{toast}</div> : null}
      <section className="page-hero">
        <p className="page-hero-kicker">Admin</p>
        <h1 className="page-hero-title">Forms dashboard</h1>
        <p className="page-hero-lead">Select a form to edit its fields, or create a new one from a dedicated page.</p>
      </section>

      {error ? (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-dismiss" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <div className="card card-pad">
        <div className="card-header">
          <h2 className="card-title">Your forms</h2>
          <div className="row-actions">
            <Link to="/admin/forms/new" className="btn btn-primary btn-sm">
              Create form
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : forms.length === 0 ? (
          <p className="muted">No forms yet. Create one above.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Active</th>
                  <th>Updated</th>
                  <th className="table-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f._id}>
                    <td>
                      <Link to={`/admin/forms/${f._id}`} className="table-link">
                        {f.name}
                      </Link>
                    </td>
                    <td>
                      <div className="table-toggle-cell">
                        <ToggleSwitch
                          checked={Boolean(f.isActive)}
                          disabled={togglingId === f._id}
                          label={`Toggle active for ${f.name}`}
                          onChange={() => toggleFormActive(f)}
                        />
                        <span className="badge badge-neutral">{f.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: "0.85rem" }}>
                      {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="table-actions-col">
                      <div className="row-actions row-actions-tight row-actions-inline">
                        <Link
                          to={`/admin/forms/${f._id}`}
                          className="btn btn-ghost btn-sm icon-action-btn"
                          title="View details"
                          aria-label="View details"
                        >
                          <svg viewBox="0 0 24 24" className="icon-action-svg" aria-hidden="true">
                            <path
                              d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </Link>
                        <Link
                          to={`/admin/forms/${f._id}`}
                          className="btn btn-secondary btn-sm icon-action-btn"
                          title="Edit"
                          aria-label="Edit"
                        >
                          <svg viewBox="0 0 24 24" className="icon-action-svg" aria-hidden="true">
                            <path
                              d="M3 17.25V21h3.75L18.4 9.35l-3.75-3.75L3 17.25Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M13.9 6.1 17.65 9.85"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm icon-action-btn"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => setPendingDelete({ id: f._id, name: f.name })}
                        >
                          <svg viewBox="0 0 24 24" className="icon-action-svg" aria-hidden="true">
                            <path
                              d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomDialog
        open={Boolean(pendingDelete)}
        title="Delete form"
        message={`Delete "${pendingDelete?.name || ""}" and all fields? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDeleteForm();
        }}
      />
    </div>
  );
}
