import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { pickUniqueFieldKey, pickUniqueFormKey } from "../utils/formKey";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "password", label: "Password" },
  { value: "dropdown", label: "Dropdown" },
];

function emptyField(priority) {
  return {
    label: "",
    type: "text",
    priority,
    required: false,
    enabled: true,
    minLength: "",
    maxLength: "",
    options: ["", ""],
  };
}

export function AdminFormCreatePage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fieldDraft, setFieldDraft] = useState(emptyField(1));
  const [draftFields, setDraftFields] = useState([]);
  const [fieldDraftErrors, setFieldDraftErrors] = useState({});
  const [editingDraftIndex, setEditingDraftIndex] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingDraftErrors, setEditingDraftErrors] = useState({});

  const nextPriority = useMemo(() => {
    if (draftFields.length === 0) return 1;
    return Math.max(...draftFields.map((f) => f.priority)) + 1;
  }, [draftFields]);

  useEffect(() => {
    let mounted = true;
    async function loadForms() {
      setLoading(true);
      try {
        const data = await api("/api/admin/forms");
        if (mounted) setForms(Array.isArray(data) ? data : []);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadForms();
    return () => {
      mounted = false;
    };
  }, []);

  function stopNumberWheel(e) {
    e.preventDefault();
  }

  function toSafeInt(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    return parsed;
  }

  function validateDraftInput(draft, existingFields, currentIndex = null) {
    const errors = {};
    const normalizedLabel = draft.label.trim().toLowerCase();

    if (!draft.label.trim()) {
      errors.label = "Field label is required.";
    } else {
      const duplicateLabel = existingFields.some(
        (field, idx) => idx !== currentIndex && String(field.label || "").trim().toLowerCase() === normalizedLabel
      );
      if (duplicateLabel) {
        errors.label = "This field already exists.";
      }
    }

    const priority = toSafeInt(draft.priority);
    if (priority == null || priority < 1) {
      errors.priority = "Priority must be a number greater than 0.";
    } else {
      const duplicate = existingFields.some((field, idx) => idx !== currentIndex && Number(field.priority) === priority);
      if (duplicate) {
        errors.priority = "This priority is already used.";
      }
    }

    if (["text", "textarea", "email"].includes(draft.type)) {
      const minLength = toSafeInt(draft.minLength);
      const maxLength = toSafeInt(draft.maxLength);

      if (draft.minLength !== "" && (minLength == null || minLength < 0)) {
        errors.minLength = "Min length must be a valid number (0 or greater).";
      }
      if (draft.maxLength !== "" && (maxLength == null || maxLength < 0)) {
        errors.maxLength = "Max length must be a valid number (0 or greater).";
      }
      if (minLength != null && maxLength != null && minLength > maxLength) {
        errors.maxLength = "Max length must be greater than or equal to min length.";
      }
    }

    if (draft.type === "dropdown" && draft.options.filter((x) => x.trim()).length === 0) {
      errors.options = "Dropdown must have at least one value.";
    }

    return errors;
  }

  function addFieldDraft(e) {
    e.preventDefault();
    setFieldDraftErrors({});
    const validationErrors = validateDraftInput(fieldDraft, draftFields);
    if (Object.keys(validationErrors).length > 0) {
      setFieldDraftErrors(validationErrors);
      setError("Please fix highlighted field errors.");
      return;
    }

    const fieldKey = pickUniqueFieldKey(
      fieldDraft.label,
      draftFields.map((x) => x.fieldKey)
    );

    const payload = {
      fieldKey,
      label: fieldDraft.label.trim(),
      type: fieldDraft.type,
      priority: Number(fieldDraft.priority),
      required: fieldDraft.required,
      enabled: fieldDraft.enabled,
    };
    if (["text", "textarea", "email"].includes(fieldDraft.type)) {
      if (fieldDraft.minLength !== "") payload.minLength = Number(fieldDraft.minLength);
      if (fieldDraft.maxLength !== "") payload.maxLength = Number(fieldDraft.maxLength);
    }
    if (fieldDraft.type === "dropdown") {
      payload.options = fieldDraft.options
        .filter((opt) => opt.trim())
        .map((opt) => ({ label: opt.trim(), value: opt.trim().toLowerCase().replace(/\s+/g, "-") }));
    }

    setDraftFields((prev) => [...prev, payload]);
    setFieldDraft(emptyField(nextPriority + 1));
    setFieldDraftErrors({});
    setError("");
  }

  async function handleSaveForm() {
    setError("");
    if (!name.trim()) {
      setError("Form name is required.");
      return;
    }
    for (let idx = 0; idx < draftFields.length; idx += 1) {
      const validationErrors = validateDraftInput(draftFields[idx], draftFields, idx);
      if (Object.keys(validationErrors).length > 0) {
        setError(`Invalid field data in row ${idx + 1}. Please fix before saving.`);
        return;
      }
    }
    setSaving(true);
    try {
      const key = pickUniqueFormKey(name, forms.map((f) => f.key));
      const created = await api("/api/admin/forms", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), key, isActive }),
      });

      for (const field of draftFields) {
        await api(`/api/admin/forms/${created._id}/fields`, {
          method: "POST",
          body: JSON.stringify(field),
        });
      }

      navigate(`/admin/forms/${created._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openDraftEdit(index) {
    const target = draftFields[index];
    setEditingDraftIndex(index);
    setEditingDraft({
      label: target.label,
      type: target.type,
      priority: target.priority,
      required: target.required,
      enabled: target.enabled,
      minLength: target.minLength ?? "",
      maxLength: target.maxLength ?? "",
      options: target.options?.map((o) => o.label) ?? ["", ""],
    });
    setEditingDraftErrors({});
  }

  function saveDraftEdit(e) {
    e.preventDefault();
    if (editingDraftIndex == null || !editingDraft) return;
    setEditingDraftErrors({});
    const validationErrors = validateDraftInput(editingDraft, draftFields, editingDraftIndex);
    if (Object.keys(validationErrors).length > 0) {
      setEditingDraftErrors(validationErrors);
      setError("Please fix highlighted field errors.");
      return;
    }

    const current = draftFields[editingDraftIndex];
    const updated = {
      ...current,
      label: editingDraft.label.trim(),
      type: editingDraft.type,
      priority: Number(editingDraft.priority),
      required: editingDraft.required,
      enabled: editingDraft.enabled,
    };
    if (["text", "textarea", "email"].includes(editingDraft.type)) {
      if (editingDraft.minLength !== "") updated.minLength = Number(editingDraft.minLength);
      else delete updated.minLength;
      if (editingDraft.maxLength !== "") updated.maxLength = Number(editingDraft.maxLength);
      else delete updated.maxLength;
    } else {
      delete updated.minLength;
      delete updated.maxLength;
    }
    if (editingDraft.type === "dropdown") {
      updated.options = editingDraft.options
        .filter((opt) => opt.trim())
        .map((opt) => ({ label: opt.trim(), value: opt.trim().toLowerCase().replace(/\s+/g, "-") }));
    } else {
      updated.options = [];
    }

    setDraftFields((prev) => prev.map((item, idx) => (idx === editingDraftIndex ? updated : item)));
    setEditingDraftIndex(null);
    setEditingDraft(null);
  }

  return (
    <div className="stack">
      <section className="page-hero page-hero-compact">
        <p className="page-hero-kicker">Forms</p>
        <h1 className="page-hero-title">Create new form</h1>
        <p className="page-hero-lead">Add multiple fields, then save everything in one go.</p>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card-pad create-page-card stack">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="new-form-name">Form name</label>
            <input
              id="new-form-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Admission Form"
              minLength={2}
              required
              disabled={loading || saving}
            />
          </div>
          <label className="checkbox-row field">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={saving}
            />
            Start as active
          </label>
        </form>

        <div className="divider" />

        <h3>Add field</h3>
        <form onSubmit={addFieldDraft}>
          <div className="grid-2">
            <div className="field">
              <label>Label</label>
              <input
                className={`input ${fieldDraftErrors.label ? "field-control-error" : ""}`}
                value={fieldDraft.label}
                onChange={(e) => setFieldDraft((prev) => ({ ...prev, label: e.target.value }))}
                required
              />
              {fieldDraftErrors.label ? <p className="muted" style={{ color: "var(--color-danger)" }}>{fieldDraftErrors.label}</p> : null}
            </div>
            <div className="field">
              <label>Type</label>
              <select
                className="select"
                value={fieldDraft.type}
                onChange={(e) => setFieldDraft((prev) => ({ ...prev, type: e.target.value }))}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <input
                className={`input ${fieldDraftErrors.priority ? "field-control-error" : ""}`}
                type="number"
                min={1}
                value={fieldDraft.priority}
                onChange={(e) => setFieldDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                onWheel={stopNumberWheel}
              />
              {fieldDraftErrors.priority ? <p className="muted" style={{ color: "var(--color-danger)" }}>{fieldDraftErrors.priority}</p> : null}
            </div>
          </div>

          {["text", "textarea", "email"].includes(fieldDraft.type) ? (
            <div className="grid-2">
              <div className="field">
                <label>Min length (optional)</label>
                <input
                  className={`input ${fieldDraftErrors.minLength ? "field-control-error" : ""}`}
                  type="number"
                  min={0}
                  value={fieldDraft.minLength}
                  onChange={(e) => setFieldDraft((prev) => ({ ...prev, minLength: e.target.value }))}
                  onWheel={stopNumberWheel}
                />
                {fieldDraftErrors.minLength ? <p className="muted" style={{ color: "var(--color-danger)" }}>{fieldDraftErrors.minLength}</p> : null}
              </div>
              <div className="field">
                <label>Max length (optional)</label>
                <input
                  className={`input ${fieldDraftErrors.maxLength ? "field-control-error" : ""}`}
                  type="number"
                  min={0}
                  value={fieldDraft.maxLength}
                  onChange={(e) => setFieldDraft((prev) => ({ ...prev, maxLength: e.target.value }))}
                  onWheel={stopNumberWheel}
                />
                {fieldDraftErrors.maxLength ? <p className="muted" style={{ color: "var(--color-danger)" }}>{fieldDraftErrors.maxLength}</p> : null}
              </div>
            </div>
          ) : null}

          {fieldDraft.type === "dropdown" ? (
            <div className="field">
              <label>Dropdown values</label>
              {fieldDraft.options.map((opt, idx) => (
                <div key={idx} className="option-row option-row-single">
                  <input
                    className="input"
                    value={opt}
                    placeholder="e.g. Male"
                    onChange={(e) => {
                      const options = [...fieldDraft.options];
                      options[idx] = e.target.value;
                      setFieldDraft((prev) => ({ ...prev, options }));
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setFieldDraft((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFieldDraft((prev) => ({ ...prev, options: [...prev.options, ""] }))}
              >
                Add value
              </button>
              {fieldDraftErrors.options ? <p className="muted" style={{ color: "var(--color-danger)" }}>{fieldDraftErrors.options}</p> : null}
            </div>
          ) : null}

          <label className="checkbox-row field">
            <input
              type="checkbox"
              checked={fieldDraft.required}
              onChange={(e) => setFieldDraft((prev) => ({ ...prev, required: e.target.checked }))}
            />
            Required
          </label>
          <label className="checkbox-row field">
            <input
              type="checkbox"
              checked={fieldDraft.enabled}
              onChange={(e) => setFieldDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Field active
          </label>
          <button className="btn btn-primary" type="submit">
            Add field
          </button>
        </form>

        <div className="divider" />
        <h3>Ready fields ({draftFields.length})</h3>
        {draftFields.length === 0 ? (
          <p className="muted">No fields added yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Required</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draftFields.map((field, idx) => (
                  <tr key={`${field.fieldKey}-${idx}`}>
                    <td>{field.label}</td>
                    <td>{field.type}</td>
                    <td>{field.priority}</td>
                    <td>{field.required ? "Yes" : "No"}</td>
                    <td className="table-actions-col">
                      <div className="row-actions row-actions-tight" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDraftEdit(idx)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setDraftFields((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={handleSaveForm} disabled={loading || saving}>
            {saving ? "Saving..." : "Save form"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/forms")}>
            Cancel
          </button>
        </div>
      </div>

      {editingDraft ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setEditingDraft(null);
            setEditingDraftIndex(null);
          }}
        >
          <div className="modal card card-pad" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "1rem" }}>Edit field</h2>
            <form onSubmit={saveDraftEdit}>
              <div className="grid-2">
                <div className="field">
                  <label>Label</label>
                  <input
                    className={`input ${editingDraftErrors.label ? "field-control-error" : ""}`}
                    value={editingDraft.label}
                    onChange={(e) => setEditingDraft((prev) => ({ ...prev, label: e.target.value }))}
                    required
                  />
                  {editingDraftErrors.label ? <p className="muted" style={{ color: "var(--color-danger)" }}>{editingDraftErrors.label}</p> : null}
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    className="select"
                    value={editingDraft.type}
                    onChange={(e) => setEditingDraft((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Priority</label>
                  <input
                    className={`input ${editingDraftErrors.priority ? "field-control-error" : ""}`}
                    type="number"
                    min={1}
                    value={editingDraft.priority}
                    onChange={(e) => setEditingDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                    onWheel={stopNumberWheel}
                  />
                  {editingDraftErrors.priority ? <p className="muted" style={{ color: "var(--color-danger)" }}>{editingDraftErrors.priority}</p> : null}
                </div>
              </div>
              <div className="row-actions">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingDraft(null);
                    setEditingDraftIndex(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
