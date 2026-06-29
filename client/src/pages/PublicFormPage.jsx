import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PasswordHint } from "../components/PasswordHint";
import { PasswordInputWithToggle } from "../components/PasswordInputWithToggle";
import {
  computeLivePasswordErrors,
  getPasswordConfirmPairs,
  getTextFieldLettersOnlyErrorIfInvalid,
  TEXT_FIELD_LETTERS_ONLY_HINT,
  validateFormFieldValues,
} from "../utils/formFieldValidation";

export function PublicFormPage() {
  const { formKey } = useParams();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [validateOk, setValidateOk] = useState("");
  const [passwordPlainVisible, setPasswordPlainVisible] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState("");

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
  const hasBinaryField = fields.some((f) => ["image", "file"].includes(f.type));

  const sortedFields = useMemo(() => [...fields].sort((a, b) => (a.priority || 0) - (b.priority || 0)), [fields]);
  const passwordPairs = useMemo(() => getPasswordConfirmPairs(sortedFields), [sortedFields]);
  const confirmToPasswordKey = useMemo(
    () => new Map(passwordPairs.map((p) => [p.confirmKey, p.passwordKey])),
    [passwordPairs]
  );
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.fieldKey, f])), [fields]);

  async function handleSubmit(e) {
    e.preventDefault();
    setValidateOk("");
    setError("");
    const { errors, ok } = validateFormFieldValues(fields, values);
    setFieldErrors(errors);
    if (!ok) return;

    setSubmitting(true);
    try {
      let payload = values;
      let headers = undefined;
      if (hasBinaryField) {
        const formData = new FormData();
        fields.forEach((f) => {
          const current = values[f.fieldKey];
          if (["image", "file"].includes(f.type)) {
            if (current instanceof File) {
              formData.append(f.fieldKey, current);
            }
            return;
          }
          formData.append(f.fieldKey, current == null ? "" : String(current));
        });
        payload = formData;
        headers = {};
      }

      const res = await api(`/api/forms/${encodeURIComponent(formKey)}/submit`, {
        method: "POST",
        body: hasBinaryField ? payload : JSON.stringify(payload),
        headers,
      });
      setSubmitted(true);
      setSubmissionId(res.submissionId || "");
      const initial = {};
      fields.forEach((f) => {
        initial[f.fieldKey] = "";
      });
      setValues(initial);
    } catch (err) {
      if (err.body && err.body.errors) {
        setFieldErrors(err.body.errors);
      } else {
        setError(err.message || "Failed to submit form responses");
      }
    } finally {
      setSubmitting(false);
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

  if (submitted) {
    return (
      <div className="public-wrap">
        <div className="card card-pad public-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", color: "#22c55e", marginBottom: "1rem" }}>✓</div>
          <h1>Response Submitted</h1>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Thank you! Your response has been successfully recorded.
          </p>
          {submissionId ? (
            <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Submission ID: <code>{submissionId}</code>
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSubmitted(false);
              setValidateOk("");
              setFieldErrors({});
            }}
          >
            Submit another response
          </button>
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
            Fill in the fields below and submit your response.
          </p>
        </div>

        {error ? (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        ) : null}

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
                ) : f.type === "text" ? (
                  <>
                    <input
                      id={id}
                      className={`input ${err ? "field-control-error" : ""}`}
                      type="text"
                      value={values[f.fieldKey] ?? ""}
                      minLength={f.minLength}
                      maxLength={f.maxLength}
                      onChange={(e) => {
                        setValidateOk("");
                        const raw = e.target.value;
                        setValues((prev) => ({ ...prev, [f.fieldKey]: raw }));
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          const fmt = getTextFieldLettersOnlyErrorIfInvalid(raw);
                          if (fmt) next[f.fieldKey] = fmt;
                          else delete next[f.fieldKey];
                          return next;
                        });
                      }}
                    />
                    {String(values[f.fieldKey] ?? "").length > 0 ? (
                      <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0", lineHeight: 1.35 }}>
                        {TEXT_FIELD_LETTERS_ONLY_HINT}
                      </p>
                    ) : null}
                  </>
                ) : f.type === "alphanumeric" ? (
                  <input
                    id={id}
                    className={`input ${err ? "field-control-error" : ""}`}
                    type="text"
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
                ) : f.type === "image" ? (
                  <>
                    <div className="image-upload-row">
                      <div className="image-upload-meta">
                        {values[f.fieldKey] instanceof File ? (
                          <p className="muted" style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.35 }}>
                            Selected: {values[f.fieldKey].name}
                          </p>
                        ) : (
                          <p className="muted" style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.35 }}>
                            Upload image
                          </p>
                        )}
                      </div>
                      <input
                        id={id}
                        className="sr-only"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setValidateOk("");
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next[f.fieldKey];
                            return next;
                          });
                          const file = e.target.files && e.target.files[0] ? e.target.files[0] : "";
                          setValues((prev) => ({ ...prev, [f.fieldKey]: file }));
                        }}
                      />
                      <label htmlFor={id} className={`image-upload-box ${err ? "field-control-error" : ""}`}>
                        <span>{values[f.fieldKey] instanceof File ? "Change" : "Upload"}</span>
                      </label>
                    </div>
                  </>
                ) : f.type === "file" ? (
                  <>
                    <input
                      id={id}
                      className={`input ${err ? "field-control-error" : ""}`}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        setValidateOk("");
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[f.fieldKey];
                          return next;
                        });
                        const file = e.target.files && e.target.files[0] ? e.target.files[0] : "";
                        setValues((prev) => ({ ...prev, [f.fieldKey]: file }));
                      }}
                    />
                    {values[f.fieldKey] instanceof File ? (
                      <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0", lineHeight: 1.35 }}>
                        Selected: {values[f.fieldKey].name}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <input
                    id={id}
                    className={`input ${err ? "field-control-error" : ""}`}
                    type={f.type === "number" ? "number" : "email"}
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
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit response"}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
