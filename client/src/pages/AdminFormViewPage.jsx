import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PasswordHint } from "../components/PasswordHint";
import { PasswordInputWithToggle } from "../components/PasswordInputWithToggle";
import { computeLivePasswordErrors, getPasswordConfirmPairs, validateFormFieldValues } from "../utils/formFieldValidation";

export function AdminFormViewPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [validateOk, setValidateOk] = useState("");
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

  return (
    <div className="stack">
      <section className="page-hero page-hero-compact">
        <p className="page-hero-kicker">View</p>
        <h1 className="page-hero-title">Form preview</h1>
        <p className="page-hero-lead">
          Interactive preview: type and use Validate — rules run locally; responses are not collected.
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
                setValidateOk("");
                const { errors, ok } = validateFormFieldValues(visible, values);
                setFieldErrors(errors);
                if (ok) {
                  setValidateOk("All checks passed. Preview does not save data.");
                }
              }}
              autoComplete="off"
            >
              {validateOk ? <div className="alert">{validateOk}</div> : null}
              {visible.map((field) => {
                const err = fieldErrors[field.fieldKey];
                return (
                  <div className="field-preview-row" key={field._id}>
                    <div style={{ width: "100%" }}>
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
                      ) : (
                        <>
                          <input
                            className={`input ${err ? "field-control-error" : values[field.fieldKey] ? "field-control-has-value" : ""}`}
                            type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
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
              <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}>
                Validate form
              </button>
            </form>
          )
        ) : null}
      </div>
    </div>
  );
}
