import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export function PublicFormPage() {
  const { formKey } = useParams();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setLoading(true);
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
          <p className="muted">This form is view only — responses are not collected.</p>
        </div>

        <form
          className="public-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {fields.map((f) => {
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
                    readOnly
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                  />
                ) : f.type === "dropdown" ? (
                  <select
                    id={id}
                    className="select"
                    value={values[f.fieldKey] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }))}
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
                    readOnly
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                  />
                )}
              </div>
            );
          })}

          {fields.length === 0 ? <p className="muted">This form has no active fields yet.</p> : null}
        </form>
      </div>
    </div>
  );
}
