import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PasswordHint } from "../components/PasswordHint";
import { PasswordInputWithToggle } from "../components/PasswordInputWithToggle";
import { computeLivePasswordErrors, getPasswordConfirmPairs, validateFormFieldValues } from "../utils/formFieldValidation";

export function PublicFormPage() {
  const { formKey } = useParams();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [validateOk, setValidateOk] = useState("");
  const [passwordPlainVisible, setPasswordPlainVisible] = useState({});

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
          initial[f.fieldKey] = "";
        });
        setValues(initial);
        setFieldErrors({});
        setValidateOk("");
        setPasswordPlainVisible({});
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

  const sortedFields = useMemo(() => [...fields].sort((a, b) => (a.priority || 0) - (b.priority || 0)), [fields]);
  const passwordPairs = useMemo(() => getPasswordConfirmPairs(sortedFields), [sortedFields]);
  const confirmToPasswordKey = useMemo(
    () => new Map(passwordPairs.map((p) => [p.confirmKey, p.passwordKey])),
    [passwordPairs]
  );
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.fieldKey, f])), [fields]);

  function handleSubmit(e) {
    e.preventDefault();
    setValidateOk("");
    const { errors, ok } = validateFormFieldValues(fields, values);
    setFieldErrors(errors);
    if (ok) {
      setValidateOk("All checks passed. Responses are not saved on this demo form.");
    }
  }

  function handlePasswordChange(fieldKey, nextVal) {
    setValidateOk("");
    setValues((prev) => {
      const nextValues = { ...prev, [fieldKey]: nextVal };
      setFieldErrors((er) => {
        const merged = { ...er };
        for (const pf of fields) {
          if (pf.type === "password") delete merged[pf.fieldKey];
        }
        Object.assign(merged, computeLivePasswordErrors(fields, nextValues));
        return merged;
      });
      return nextValues;
    });
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
          <p className="muted">
            You can type in the fields for validation only. Nothing is sent or stored when you validate.
          </p>
        </div>

        {validateOk ? (
          <div className="alert" style={{ marginBottom: "1rem" }}>
            {validateOk}
          </div>
        ) : null}

        <form className="public-form" onSubmit={handleSubmit}>
          {fields.map((f) => {
            const id = `field-${f.fieldKey}`;
            const err = fieldErrors[f.fieldKey];
            return (
              <div className="field" key={f._id || f.fieldKey}>
                <label htmlFor={id}>
                  {f.label}
                  {f.required ? <span style={{ color: "var(--color-accent)" }}> *</span> : null}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={id}
                    className={`textarea ${err ? "field-control-error" : ""}`}
                    value={values[f.fieldKey] ?? ""}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                    onChange={(e) => {
                      setValidateOk("");
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next[f.fieldKey];
                        return next;
                      });
                      setValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }));
                    }}
                  />
                ) : f.type === "dropdown" ? (
                  <select
                    id={id}
                    className={`select ${err ? "field-control-error" : ""}`}
                    value={values[f.fieldKey] ?? ""}
                    onChange={(e) => {
                      setValidateOk("");
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next[f.fieldKey];
                        return next;
                      });
                      setValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }));
                    }}
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "password" ? (
                  <>
                    <PasswordInputWithToggle
                      id={id}
                      className={err ? "field-control-error" : ""}
                      value={values[f.fieldKey] ?? ""}
                      minLength={f.minLength}
                      maxLength={f.maxLength}
                      plainVisible={Boolean(passwordPlainVisible[f.fieldKey])}
                      onTogglePlain={() =>
                        setPasswordPlainVisible((prev) => ({
                          ...prev,
                          [f.fieldKey]: !prev[f.fieldKey],
                        }))
                      }
                      onChange={(e) => handlePasswordChange(f.fieldKey, e.target.value)}
                    />
                    <PasswordHint
                      ruleField={
                        confirmToPasswordKey.has(f.fieldKey)
                          ? fieldByKey.get(confirmToPasswordKey.get(f.fieldKey))
                          : f
                      }
                      error={err}
                    />
                  </>
                ) : (
                  <input
                    id={id}
                    className={`input ${err ? "field-control-error" : ""}`}
                    type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                    value={values[f.fieldKey] ?? ""}
                    minLength={f.minLength}
                    maxLength={f.maxLength}
                    onChange={(e) => {
                      setValidateOk("");
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next[f.fieldKey];
                        return next;
                      });
                      setValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }));
                    }}
                  />
                )}
                {f.type !== "password" && err ? (
                  <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>{err}</p>
                ) : null}
              </div>
            );
          })}

          {fields.length === 0 ? <p className="muted">This form has no active fields yet.</p> : null}

          {fields.length > 0 ? (
            <div style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn btn-primary">
                Validate form
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
