import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export function AdminFormViewPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [formNonce] = useState(() => Math.random().toString(36).slice(2, 10));

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [f, list] = await Promise.all([
          api(`/api/admin/forms/${formId}`),
          api(`/api/admin/forms/${formId}/fields`),
        ]);
        if (!mounted) return;
        setForm(f);
        setFields(Array.isArray(list) ? list : []);
        const initial = {};
        (Array.isArray(list) ? list : []).forEach((field) => {
          initial[field.fieldKey] = "";
        });
        setValues(initial);
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [formId]);

  const visible = form?.isActive ? fields.filter((f) => f.enabled) : [];

  return (
    <div className="stack">
      <section className="page-hero page-hero-compact">
        <p className="page-hero-kicker">View</p>
        <h1 className="page-hero-title">Form preview</h1>
        <p className="page-hero-lead">Read-only preview of how the form appears to users. Responses are not collected.</p>
      </section>

      <div className="card card-pad view-page-card">
        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 className="card-title">{form?.name || "Form"}</h2>
          <Link to={`/admin/forms/${formId}`} className="btn btn-secondary btn-sm">
            Back to edit
          </Link>
        </div>
        {loading ? <p className="muted">Loading...</p> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        {!loading ? (
          !form?.isActive ? (
            <p className="muted">Form is inactive, so fields are hidden.</p>
          ) : visible.length === 0 ? (
            <p className="muted">No active fields in this form yet.</p>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
              }}
              autoComplete="off"
            >
              {visible.map((field) => (
                <div className="field-preview-row" key={field._id}>
                  <div style={{ width: "100%" }}>
                    <strong>
                      {field.label}
                      {field.required ? <span className="required-star"> *</span> : null}
                    </strong>
                    {field.type === "textarea" ? (
                      <textarea
                        className={`textarea ${values[field.fieldKey] ? "field-control-has-value" : ""}`}
                        value={values[field.fieldKey] ?? ""}
                        readOnly
                        minLength={field.minLength}
                        maxLength={field.maxLength}
                        autoComplete="off"
                        name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                        style={{ marginTop: "0.5rem" }}
                      />
                    ) : field.type === "dropdown" ? (
                      <select
                        className={`select ${values[field.fieldKey] ? "field-control-has-value" : ""}`}
                        value={values[field.fieldKey] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))}
                        autoComplete="off"
                        name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                        style={{ marginTop: "0.5rem" }}
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={`input ${values[field.fieldKey] ? "field-control-has-value" : ""}`}
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "email"
                            ? "email"
                            : field.type === "password"
                            ? "password"
                            : "text"
                        }
                        value={values[field.fieldKey] ?? ""}
                        readOnly
                        minLength={field.minLength}
                        maxLength={field.maxLength}
                        autoComplete={field.type === "password" ? "new-password" : "off"}
                        name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                        style={{ marginTop: "0.5rem" }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </form>
          )
        ) : null}
      </div>
    </div>
  );
}
