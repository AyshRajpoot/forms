import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export function PublicFormPage() {
  const { formKey } = useParams();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setLoading(true);
      setDone(false);
      try {
        const res = await api(`/api/forms/${encodeURIComponent(formKey)}/active-fields`);
        if (cancelled) return;
        setData(res);
        const initial = {};
        (res.fields || []).forEach((f) => {
          initial[f.fieldKey] = f.type === "number" ? "" : "";
        });
        setValues(initial);
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load form");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [formKey]);

  const fields = data?.fields || [];

  const payload = useMemo(() => {
    const out = {};
    fields.forEach((f) => {
      const raw = values[f.fieldKey];
      if (f.type === "number" && raw !== "" && raw != null) {
        const n = Number(raw);
        out[f.fieldKey] = Number.isNaN(n) ? raw : n;
      } else {
        out[f.fieldKey] = raw;
      }
    });
    return out;
  }, [fields, values]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api(`/api/forms/${encodeURIComponent(formKey)}/submissions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDone(true);
      const reset = {};
      fields.forEach((f) => {
        reset[f.fieldKey] = "";
      });
      setValues(reset);
    } catch (err) {
      if (err.body?.errors && typeof err.body.errors === "object") {
        setFieldErrors(err.body.errors);
        setError(err.message || "Please fix the highlighted fields.");
      } else {
        setError(err.message || "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="public-wrap">
        <p className="muted">Loading form…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="public-wrap">
        <div className="card card-pad public-card">
          <h1>Form unavailable</h1>
          <p className="muted">{error}</p>
          <p className="muted">
            <Link to="/">Home</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-wrap">
      <div className="card card-pad public-card">
        <div className="public-head">
          <h1>{data?.form?.name || "Form"}</h1>
          <p className="muted">Please fill in all required fields and submit.</p>
        </div>

        {done ? (
          <div className="alert alert-success" role="status">
            Thank you — your response was submitted successfully.
          </div>
        ) : null}

        {error && data ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="public-form">
          {fields.map((f) => {
            const err = fieldErrors[f.fieldKey];
            const id = `field-${f.fieldKey}`;
            return (
              <div className="field" key={f._id || f.fieldKey}>
                <label htmlFor={id}>
                  {f.label}
                  {f.required ? <span style={{ color: "var(--color-accent)" }}> *</span> : null}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={id}
                    className="textarea"
                    value={values[f.fieldKey] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.fieldKey]: e.target.value })}
                    required={f.required}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                  />
                ) : f.type === "dropdown" ? (
                  <select
                    id={id}
                    className="select"
                    value={values[f.fieldKey] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.fieldKey]: e.target.value })}
                    required={f.required}
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input"
                    type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "password" ? "password" : "text"}
                    value={values[f.fieldKey] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.fieldKey]: e.target.value })}
                    required={f.required}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                  />
                )}
                {err ? (
                  <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>{err}</p>
                ) : null}
              </div>
            );
          })}

          {fields.length === 0 ? (
            <p className="muted">This form has no active fields yet.</p>
          ) : (
            <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
