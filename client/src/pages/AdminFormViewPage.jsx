import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { CenterNotice } from "../components/CenterNotice";
import { PasswordHint } from "../components/PasswordHint";
import { PasswordInputWithToggle } from "../components/PasswordInputWithToggle";
import {
  computeLivePasswordErrors,
  getPasswordConfirmPairs,
  getTextFieldLettersOnlyErrorIfInvalid,
  TEXT_FIELD_LETTERS_ONLY_HINT,
  validateFormFieldValues,
} from "../utils/formFieldValidation";

export function AdminFormViewPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [validateOk, setValidateOk] = useState("");
  const [submitState, setSubmitState] = useState({ saving: false, success: "", error: "" });
  const [formNonce] = useState(() => Math.random().toString(36).slice(2, 10));
  const [passwordPlainVisible, setPasswordPlainVisible] = useState({});

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
        setFieldErrors({});
        setValidateOk("");
        setPasswordPlainVisible({});
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

  const sortedVisible = useMemo(() => [...visible].sort((a, b) => (a.priority || 0) - (b.priority || 0)), [visible]);
  const passwordPairs = useMemo(() => getPasswordConfirmPairs(sortedVisible), [sortedVisible]);
  const confirmToPasswordKey = useMemo(
    () => new Map(passwordPairs.map((p) => [p.confirmKey, p.passwordKey])),
    [passwordPairs]
  );
  const fieldByKey = useMemo(() => new Map(visible.map((f) => [f.fieldKey, f])), [visible]);
  const hasBinaryField = useMemo(() => visible.some((field) => ["image", "file"].includes(field.type)), [visible]);
  const submitButtonWrapStyle = {
    marginTop: "1rem",
    display: "flex",
    justifyContent: "center",
    width: "100%",
  };
  const submitButtonStyle = { minWidth: "220px" };
  const submitErrorMessage = submitState.error?.trim();
  const submitSuccessMessage = submitState.success?.trim();

  function handlePasswordChange(fieldKey, nextVal) {
    setValidateOk("");
    setValues((prev) => {
      const nextValues = { ...prev, [fieldKey]: nextVal };
      setFieldErrors((er) => {
        const merged = { ...er };
        for (const pf of visible) {
          if (pf.type === "password") delete merged[pf.fieldKey];
        }
        Object.assign(merged, computeLivePasswordErrors(visible, nextValues));
        return merged;
      });
      return nextValues;
    });
  }

  function validateCurrentValues() {
    setValidateOk("");
    setSubmitState((prev) => ({ ...prev, error: "", success: "" }));
    const { errors, ok } = validateFormFieldValues(visible, values);
    setFieldErrors(errors);
    return ok;
  }

  async function handleSaveSubmission() {
    if (!form?.key) {
      setSubmitState({ saving: false, success: "", error: "Form key is missing, cannot submit." });
      return;
    }

    const ok = validateCurrentValues();
    if (!ok) return;

    setSubmitState({ saving: true, success: "", error: "" });
    try {
      let payload = values;
      let headers = undefined;

      if (hasBinaryField) {
        const formData = new FormData();
        visible.forEach((field) => {
          const current = values[field.fieldKey];
          if (["image", "file"].includes(field.type)) {
            if (current instanceof File) {
              formData.append(field.fieldKey, current);
            }
            return;
          }
          formData.append(field.fieldKey, current == null ? "" : String(current));
        });
        payload = formData;
        headers = {};
      }

      const result = await api(`/api/forms/${encodeURIComponent(form.key)}/submit`, {
        method: "POST",
        body: hasBinaryField ? payload : JSON.stringify(payload),
        headers,
      });

      const initial = {};
      visible.forEach((field) => {
        initial[field.fieldKey] = "";
      });
      setValues(initial);
      setFieldErrors({});
      setValidateOk("");
      setSubmitState({
        saving: false,
        success: result?.submissionId
          ? `Saved to database. Submission ID: ${result.submissionId}`
          : "Saved to database successfully.",
        error: "",
      });
    } catch (err) {
      if (err?.body?.errors) {
        setFieldErrors(err.body.errors);
      }
      setSubmitState({
        saving: false,
        success: "",
        error: err?.message || "Failed to save submission.",
      });
    }
  }

  return (
    <div className="stack">
      <section className="page-hero page-hero-compact">
        <p className="page-hero-kicker">View</p>
        <h1 className="page-hero-title">Form preview</h1>
        <p className="page-hero-lead">
          Interactive preview: validate locally or submit here to save a real response in database.
        </p>
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
                void handleSaveSubmission();
              }}
              autoComplete="off"
            >
              {validateOk ? <div className="alert">{validateOk}</div> : null}
              {visible.map((field) => {
                const err = fieldErrors[field.fieldKey];
                return (
                  <div className="field-preview-row" key={field._id}>
                    <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}>
                      <strong>
                        {field.label}
                        {field.required ? <span className="required-star"> *</span> : null}
                      </strong>
                      {field.type === "textarea" ? (
                        <textarea
                          className={`textarea ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                          value={values[field.fieldKey] ?? ""}
                          minLength={field.minLength}
                          maxLength={field.maxLength}
                          autoComplete="off"
                          name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                          style={{ marginTop: "0.5rem" }}
                          onChange={(e) => {
                            setValidateOk("");
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next[field.fieldKey];
                              return next;
                            });
                            setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }));
                          }}
                        />
                      ) : field.type === "dropdown" ? (
                        <select
                          className={`select ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                          value={values[field.fieldKey] ?? ""}
                          onChange={(e) => {
                            setValidateOk("");
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next[field.fieldKey];
                              return next;
                            });
                            setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }));
                          }}
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
                      ) : field.type === "password" ? (
                        <>
                          <PasswordInputWithToggle
                            className={err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}
                            value={values[field.fieldKey] ?? ""}
                            minLength={field.minLength}
                            maxLength={field.maxLength}
                            autoComplete="new-password"
                            name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                            wrapStyle={{ marginTop: "0.5rem" }}
                            plainVisible={Boolean(passwordPlainVisible[field.fieldKey])}
                            onTogglePlain={() =>
                              setPasswordPlainVisible((prev) => ({
                                ...prev,
                                [field.fieldKey]: !prev[field.fieldKey],
                              }))
                            }
                            onChange={(e) => handlePasswordChange(field.fieldKey, e.target.value)}
                          />
                          <PasswordHint
                            ruleField={
                              confirmToPasswordKey.has(field.fieldKey)
                                ? fieldByKey.get(confirmToPasswordKey.get(field.fieldKey))
                                : field
                            }
                            error={err}
                          />
                        </>
                      ) : field.type === "text" ? (
                        <>
                          <input
                            className={`input ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                            type="text"
                            value={values[field.fieldKey] ?? ""}
                            minLength={field.minLength}
                            maxLength={field.maxLength}
                            autoComplete="off"
                            name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                            style={{ marginTop: "0.5rem" }}
                            onChange={(e) => {
                              setValidateOk("");
                              const raw = e.target.value;
                              setValues((prev) => ({ ...prev, [field.fieldKey]: raw }));
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                const fmt = getTextFieldLettersOnlyErrorIfInvalid(raw);
                                if (fmt) next[field.fieldKey] = fmt;
                                else delete next[field.fieldKey];
                                return next;
                              });
                            }}
                          />
                          {String(values[field.fieldKey] ?? "").length > 0 ? (
                            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0", lineHeight: 1.35 }}>
                              {TEXT_FIELD_LETTERS_ONLY_HINT}
                            </p>
                          ) : null}
                        </>
                      ) : field.type === "alphanumeric" ? (
                        <>
                          <input
                            className={`input ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                            type="text"
                            value={values[field.fieldKey] ?? ""}
                            minLength={field.minLength}
                            maxLength={field.maxLength}
                            autoComplete="off"
                            name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                            style={{ marginTop: "0.5rem" }}
                            onChange={(e) => {
                              setValidateOk("");
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[field.fieldKey];
                                return next;
                              });
                              setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }));
                            }}
                          />
                        </>
                      ) : field.type === "image" ? (
                        <>
                          <div className="image-upload-row" style={{ marginTop: "0.5rem" }}>
                            <div className="image-upload-meta">
                              {values[field.fieldKey] instanceof File ? (
                                <p className="muted" style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.35 }}>
                                  Selected: {values[field.fieldKey].name}
                                </p>
                              ) : (
                                <p className="muted" style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.35 }}>
                                  Upload image
                                </p>
                              )}
                            </div>
                            <input
                              id={`preview-image-${field.fieldKey}`}
                              className="sr-only"
                              type="file"
                              accept="image/*"
                              autoComplete="off"
                              name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                              onChange={(e) => {
                                setValidateOk("");
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[field.fieldKey];
                                  return next;
                                });
                                const file = e.target.files && e.target.files[0] ? e.target.files[0] : "";
                                setValues((prev) => ({ ...prev, [field.fieldKey]: file }));
                              }}
                            />
                            <label
                              htmlFor={`preview-image-${field.fieldKey}`}
                              className={`image-upload-box ${err ? "field-control-error" : ""}`}
                            >
                              <span>{values[field.fieldKey] instanceof File ? "Change" : "Upload"}</span>
                            </label>
                          </div>
                        </>
                      ) : field.type === "file" ? (
                        <>
                          <input
                            className={`input ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            autoComplete="off"
                            name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                            style={{ marginTop: "0.5rem" }}
                            onChange={(e) => {
                              setValidateOk("");
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[field.fieldKey];
                                return next;
                              });
                              const file = e.target.files && e.target.files[0] ? e.target.files[0] : "";
                              setValues((prev) => ({ ...prev, [field.fieldKey]: file }));
                            }}
                          />
                          {values[field.fieldKey] instanceof File ? (
                            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0", lineHeight: 1.35 }}>
                              Selected: {values[field.fieldKey].name}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <input
                            className={`input ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                            type={field.type === "number" ? "number" : "email"}
                            value={values[field.fieldKey] ?? ""}
                            minLength={field.minLength}
                            maxLength={field.maxLength}
                            autoComplete="off"
                            name={`field_${formId}_${field.fieldKey}_${formNonce}`}
                            style={{ marginTop: "0.5rem" }}
                            onChange={(e) => {
                              setValidateOk("");
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next[field.fieldKey];
                                return next;
                              });
                              setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }));
                            }}
                          />
                        </>
                      )}
                      {field.type !== "password" && err ? (
                        <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                          {err}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div style={submitButtonWrapStyle}>
                <button type="submit" className="btn btn-primary btn-sm" style={submitButtonStyle} disabled={submitState.saving}>
                  {submitState.saving ? "Saving..." : "Submit"}
                </button>
              </div>
              {submitErrorMessage ? (
                <p style={{ color: "var(--color-danger)", fontSize: "0.9rem", textAlign: "center", marginTop: "0.5rem" }}>
                  {submitErrorMessage}
                </p>
              ) : null}
            </form>
          )
        ) : null}
      </div>
      <CenterNotice
        open={Boolean(submitSuccessMessage)}
        title="Form submitted successfully"
        message={submitSuccessMessage}
        showCancel={false}
        okLabel="OK"
        onDismiss={() => setSubmitState((prev) => ({ ...prev, success: "" }))}
      />
    </div>
  );
}
