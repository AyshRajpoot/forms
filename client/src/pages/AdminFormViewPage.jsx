import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export function AdminFormViewPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
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
  const payload = useMemo(() => {
    const out = {};
    visible.forEach((field) => {
      const raw = values[field.fieldKey];
      if (field.type === "number" && raw !== "") {
        const num = Number(raw);
        out[field.fieldKey] = Number.isNaN(num) ? raw : num;
      } else {
        out[field.fieldKey] = raw;
      }
    });
    return out;
  }, [visible, values]);

  function getFieldErrorClass(fieldKey) {
    return fieldErrors[fieldKey] ? "field-control-error" : "";
  }

  function validateClientSubmission() {
    const errors = {};
    const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const passwordField = visible.find(
      (field) =>
        field.type === "password" &&
        (normalize(field.fieldKey).includes("password") || normalize(field.label).includes("password")) &&
        !(normalize(field.fieldKey).includes("confirm") || normalize(field.label).includes("confirm"))
    );
    const confirmPasswordField = visible.find(
      (field) =>
        field.type === "password" &&
        (normalize(field.fieldKey).includes("confirm") || normalize(field.label).includes("confirm")) &&
        (normalize(field.fieldKey).includes("password") || normalize(field.label).includes("password"))
    );

    visible.forEach((field) => {
      const value = values[field.fieldKey] ?? "";
      const isNameField =
        field.type === "text" &&
        (normalize(field.fieldKey).includes("name") || normalize(field.label).includes("name"));
      if (isNameField && value && !/^[a-zA-Z\s'-]+$/.test(String(value).trim())) {
        errors[field.fieldKey] = "This is not a valid name";
      }
    });

    if (passwordField && confirmPasswordField) {
      const passValue = values[passwordField.fieldKey];
      const confirmValue = values[confirmPasswordField.fieldKey];
      if (passValue !== undefined && confirmValue !== undefined && passValue !== confirmValue) {
        errors[confirmPasswordField.fieldKey] = "Password does not match";
      }
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form?.key) return;
    setError("");
    setFieldErrors({});
    setSuccessModalOpen(false);
    const clientErrors = validateClientSubmission();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/forms/${encodeURIComponent(form.key)}/submissions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccessModalOpen(true);
      const reset = {};
      visible.forEach((field) => {
        reset[field.fieldKey] = "";
      });
      setValues(reset);
    } catch (err) {
      if (err.body?.errors && typeof err.body.errors === "object") {
        setFieldErrors(err.body.errors);
      }
      setError(err.message || "Could not submit entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <section className="page-hero page-hero-compact">
        <p className="page-hero-kicker">View</p>
        <h1 className="page-hero-title">Form preview</h1>
        <p className="page-hero-lead">Review final screen before sharing it with users.</p>
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
            <form className="stack" onSubmit={handleSubmit} autoComplete="off">
              {visible.map((field) => (
                <div className="field-preview-row" key={field._id}>
                  <div style={{ width: "100%" }}>
                    <strong>
                      {field.label}
                      {field.required ? <span className="required-star"> *</span> : null}
                    </strong>
                    {field.type === "textarea" ? (
                      <textarea
                        className={`textarea ${values[field.fieldKey] ? "field-control-has-value" : ""} ${getFieldErrorClass(field.fieldKey)}`}
                        value={values[field.fieldKey] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))}
                        required={field.required}
                        minLength={field.minLength}
                        maxLength={field.maxLength}
                        autoComplete="off"
                        name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                        style={{ marginTop: "0.5rem" }}
                      />
                    ) : field.type === "dropdown" ? (
                      <select
                        className={`select ${values[field.fieldKey] ? "field-control-has-value" : ""} ${getFieldErrorClass(field.fieldKey)}`}
                        value={values[field.fieldKey] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))}
                        required={field.required}
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
                        className={`input ${values[field.fieldKey] ? "field-control-has-value" : ""} ${getFieldErrorClass(field.fieldKey)}`}
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
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))}
                        required={field.required}
                        minLength={field.minLength}
                        maxLength={field.maxLength}
                        autoComplete={field.type === "password" ? "new-password" : "off"}
                        name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                        style={{ marginTop: "0.5rem" }}
                      />
                    )}
                    {fieldErrors[field.fieldKey] ? (
                      <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                        {fieldErrors[field.fieldKey]}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="row-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit entry"}
                </button>
              </div>
            </form>
          )
        ) : null}
      </div>

      {successModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSuccessModalOpen(false)}>
          <div className="modal card card-pad success-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "0.5rem" }}>Form submitted successfully</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              You can now open the entries page to view this submission.
            </p>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/admin/forms/${formId}?tab=entries`)}>
                Go to entries
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSuccessModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
