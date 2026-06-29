import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { CustomDialog } from "../components/CustomDialog";
import { CenterNotice } from "../components/CenterNotice";
import { pickUniqueFieldKey } from "../utils/formKey";
import { getPasswordRequirementHint } from "../utils/formFieldValidation";
import { getFreePrioritySlotsMessage } from "../utils/priorityHints";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "alphanumeric", label: "Varchar (A-Z, 0-9)" },
  { value: "textarea", label: "Textarea" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "password", label: "Password" },
  { value: "image", label: "Image Upload" },
  { value: "file", label: "File Upload (PDF/Word)" },
  { value: "dropdown", label: "Dropdown" },
];

function previewPasswordHint(fieldState) {
  const minL = fieldState.minLength === "" ? undefined : Number(fieldState.minLength);
  const maxL = fieldState.maxLength === "" ? undefined : Number(fieldState.maxLength);
  return getPasswordRequirementHint({
    type: "password",
    minLength: minL !== undefined && Number.isFinite(minL) ? minL : undefined,
    maxLength: maxL !== undefined && Number.isFinite(maxL) ? maxL : undefined,
    passwordMinUppercase: Number(fieldState.passwordMinUppercase ?? 0),
    passwordMinLowercase: Number(fieldState.passwordMinLowercase ?? 0),
    passwordMinDigits: Number(fieldState.passwordMinDigits ?? 0),
    passwordMinSpecial: Number(fieldState.passwordMinSpecial ?? 0),
  });
}

export function AdminFormDetailPage() {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);

  const [formName, setFormName] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [fieldTogglingId, setFieldTogglingId] = useState(null);

  const [newField, setNewField] = useState({
    label: "",
    type: "text",
    enabled: true,
    priority: 1,
    required: false,
    minLength: "",
    maxLength: "",
    options: ["", ""],
    passwordMinUppercase: 1,
    passwordMinLowercase: 1,
    passwordMinDigits: 1,
    passwordMinSpecial: 1,
  });
  const [addingField, setAddingField] = useState(false);
  const [newFieldErrors, setNewFieldErrors] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editField, setEditField] = useState(null);
  const [savingField, setSavingField] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, field: null });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [centerNotice, setCenterNotice] = useState({ open: false, message: "" });
  const [dragFieldId, setDragFieldId] = useState(null);

  const nextPriority = useMemo(() => {
    if (!fields.length) return 1;
    return Math.max(...fields.map((x) => x.priority || 0)) + 1;
  }, [fields]);

  const freePriorityHint = useMemo(() => getFreePrioritySlotsMessage(fields), [fields]);

  const load = useCallback(async (opts = { showLoading: true }) => {
    const showLoading = opts.showLoading !== false;
    setError("");
    if (showLoading) setLoading(true);
    try {
      const [f, flds] = await Promise.all([
        api(`/api/admin/forms/${formId}`),
        api(`/api/admin/forms/${formId}/fields`),
      ]);
      setForm(f);
      setFormName(f.name);
      setFields(Array.isArray(flds) ? flds : []);
    } catch (e) {
      setError(e.message);
      setForm(null);
      setFields([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setNewField((prev) => ({ ...prev, priority: nextPriority }));
  }, [nextPriority]);

  async function saveFormSettings(e) {
    e.preventDefault();
    setSavedMsg("");
    setError("");
    setSavingForm(true);
    try {
      const updated = await api(`/api/admin/forms/${formId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: formName.trim() }),
      });
      setForm(updated);
      setSavedMsg("Form saved.");
      setTimeout(() => setSavedMsg(""), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingForm(false);
    }
  }

  async function toggleFormActive() {
    if (!form) return;
    setError("");
    setTogglingActive(true);
    try {
      const nextActive = !form.isActive;
      await api(`/api/admin/forms/${formId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      setForm((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
      setSavedMsg(`Form is now ${nextActive ? "active" : "inactive"}.`);
      setTimeout(() => setSavedMsg(""), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingActive(false);
    }
  }

  async function deleteForm() {
    if (!form) return;
    setError("");
    setConfirmLoading(true);
    try {
      await api(`/api/admin/forms/${formId}`, { method: "DELETE" });
      navigate("/admin/forms");
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmLoading(false);
      setConfirmDialog({ open: false, type: null, field: null });
    }
  }

  function createFieldPayload(state) {
    const body = {
      fieldKey: pickUniqueFieldKey(
        state.label,
        fields.map((field) => field.fieldKey)
      ),
      label: state.label.trim(),
      type: state.type,
      enabled: state.enabled,
      priority: Number(state.priority),
      required: state.required,
    };
    if (["text", "alphanumeric", "textarea", "email", "password"].includes(state.type)) {
      if (state.minLength !== "") body.minLength = Number(state.minLength);
      if (state.maxLength !== "") body.maxLength = Number(state.maxLength);
    }
    if (state.type === "password") {
      body.passwordMinUppercase = Number(state.passwordMinUppercase ?? 1);
      body.passwordMinLowercase = Number(state.passwordMinLowercase ?? 1);
      body.passwordMinDigits = Number(state.passwordMinDigits ?? 1);
      body.passwordMinSpecial = Number(state.passwordMinSpecial ?? 1);
    }
    if (state.type === "dropdown") {
      body.options = state.options
        .filter((opt) => opt.trim())
        .map((opt) => ({ label: opt.trim(), value: opt.trim().toLowerCase().replace(/\s+/g, "-") }));
    }
    return body;
  }

  async function addField(e) {
    e.preventDefault();
    setError("");
    setNewFieldErrors({});
    if (!newField.label.trim()) {
      setNewFieldErrors({ label: "Field label is required." });
      setError("Please fix highlighted field errors.");
      return;
    }
    const normalizedLabel = newField.label.trim().toLowerCase();
    const duplicateField = fields.some((field) => String(field.label || "").trim().toLowerCase() === normalizedLabel);
    if (duplicateField) {
      setNewFieldErrors({ label: "This field already exists." });
      setError("Please fix highlighted field errors.");
      return;
    }
    if (newField.type === "dropdown" && newField.options.filter((opt) => opt.trim()).length === 0) {
      setError("Dropdown needs at least one value.");
      return;
    }
    setAddingField(true);
    try {
      const res = await api(`/api/admin/forms/${formId}/fields`, {
        method: "POST",
        body: JSON.stringify(createFieldPayload(newField)),
      });
      if (res.priorityNotice) {
        setCenterNotice({ open: true, message: res.priorityNotice });
      }
      await load({ showLoading: false });
      setNewField({
        label: "",
        type: "text",
        enabled: true,
        priority: 1,
        required: false,
        minLength: "",
        maxLength: "",
        options: ["", ""],
        passwordMinUppercase: 1,
        passwordMinLowercase: 1,
        passwordMinDigits: 1,
        passwordMinSpecial: 1,
      });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setNewFieldErrors((prev) => ({ ...prev, label: "This field already exists." }));
      }
      setError(err.message);
    } finally {
      setAddingField(false);
    }
  }

  function openEdit(field) {
    setEditFieldErrors({});
    setEditField({
      _id: field._id,
      label: field.label,
      type: field.type,
      enabled: field.enabled,
      priority: String(field.priority),
      required: Boolean(field.required),
      minLength: field.minLength ?? "",
      maxLength: field.maxLength ?? "",
      options: field.options?.length ? field.options.map((o) => o.label) : ["", ""],
      fieldKey: field.fieldKey,
      passwordMinUppercase: field.passwordMinUppercase ?? 1,
      passwordMinLowercase: field.passwordMinLowercase ?? 1,
      passwordMinDigits: field.passwordMinDigits ?? 1,
      passwordMinSpecial: field.passwordMinSpecial ?? 1,
    });
    setEditOpen(true);
  }

  async function saveEditedField(e) {
    e.preventDefault();
    if (!editField) return;
    setError("");
    setEditFieldErrors({});
    setSavingField(true);
    try {
      const normalizedLabel = editField.label.trim().toLowerCase();
      const duplicateField = fields.some(
        (field) => field._id !== editField._id && String(field.label || "").trim().toLowerCase() === normalizedLabel
      );
      if (duplicateField) {
        setEditFieldErrors({ label: "This field already exists." });
        setError("Please fix highlighted field errors.");
        return;
      }

      const priorityNum = Number(editField.priority);
      if (!Number.isFinite(priorityNum) || priorityNum < 1) {
        setEditFieldErrors({ priority: "Enter a valid priority (1 or greater)." });
        setError("Please fix highlighted field errors.");
        return;
      }

      const body = {
        label: editField.label.trim(),
        type: editField.type,
        enabled: editField.enabled,
        priority: priorityNum,
        required: editField.required,
      };
      if (["text", "alphanumeric", "textarea", "email", "password"].includes(editField.type)) {
        if (editField.minLength !== "") body.minLength = Number(editField.minLength);
        if (editField.maxLength !== "") body.maxLength = Number(editField.maxLength);
      }
      if (editField.type === "password") {
        body.passwordMinUppercase = Number(editField.passwordMinUppercase ?? 1);
        body.passwordMinLowercase = Number(editField.passwordMinLowercase ?? 1);
        body.passwordMinDigits = Number(editField.passwordMinDigits ?? 1);
        body.passwordMinSpecial = Number(editField.passwordMinSpecial ?? 1);
      }
      if (editField.type === "dropdown") {
        body.options = editField.options
          .filter((opt) => opt.trim())
          .map((opt) => ({ label: opt.trim(), value: opt.trim().toLowerCase().replace(/\s+/g, "-") }));
      } else {
        body.options = [];
      }

      const res = await api(`/api/admin/fields/${editField._id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.priorityNotice) {
        setCenterNotice({ open: true, message: res.priorityNotice });
      }
      await load({ showLoading: false });
      setEditOpen(false);
      setEditField(null);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setEditFieldErrors((prev) => ({ ...prev, label: "This field already exists." }));
      }
      setError(err.message);
    } finally {
      setSavingField(false);
    }
  }

  async function deleteField(field) {
    setError("");
    setConfirmLoading(true);
    try {
      await api(`/api/admin/fields/${field._id}`, { method: "DELETE" });
      setFields((prev) => prev.filter((f) => f._id !== field._id));
      setSavedMsg("Field deleted successfully");
      setTimeout(() => setSavedMsg(""), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmLoading(false);
      setConfirmDialog({ open: false, type: null, field: null });
    }
  }

  async function toggleFieldEnabled(field) {
    setError("");
    setFieldTogglingId(field._id);
    try {
      const nextEnabled = !field.enabled;
      await api(`/api/admin/fields/${field._id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      setFields((prev) => prev.map((f) => (f._id === field._id ? { ...f, enabled: nextEnabled } : f)));
    } catch (err) {
      setError(err.message);
    } finally {
      setFieldTogglingId(null);
    }
  }

  async function handleFieldDrop(targetField) {
    if (!dragFieldId || dragFieldId === targetField._id) return;
    const dragged = fields.find((item) => item._id === dragFieldId);
    if (!dragged) return;

    setError("");
    try {
      const res = await api(`/api/admin/fields/${dragFieldId}`, {
        method: "PATCH",
        body: JSON.stringify({ priority: Number(targetField.priority) }),
      });
      if (res.priorityNotice) {
        setCenterNotice({ open: true, message: res.priorityNotice });
      }
      await load({ showLoading: false });
    } catch (err) {
      setError(err.message || "Failed to reorder fields");
    } finally {
      setDragFieldId(null);
    }
  }

  if (loading && !form) {
    return <p className="muted">Loading form...</p>;
  }

  if (!form && !loading) {
    return (
      <div>
        <p className="muted">Form not found.</p>
        <Link to="/admin/forms">Back to forms</Link>
      </div>
    );
  }

  const visibleFields = form?.isActive ? fields : [];

  return (
    <div className="stack">
      <p className="muted" style={{ marginBottom: "0.25rem" }}>
        <Link to="/admin/forms">← All forms</Link>
      </p>
      <section className="page-hero page-hero-compact">
        <h1 className="page-hero-title">{form.name}</h1>
        <p className="page-hero-lead">Manage form settings, preview the final structure, and open the view page from one place.</p>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {savedMsg ? <div className="alert alert-success">{savedMsg}</div> : null}

      <div className="card card-pad">
        <div className="card-header">
          <h2 className="card-title">Form settings</h2>
          <div className="row-actions settings-active-toggle">
            <span className="muted" style={{ margin: 0, fontWeight: 600 }}>
              Form active
            </span>
            <ToggleSwitch
              checked={Boolean(form.isActive)}
              disabled={togglingActive}
              label="Toggle form active"
              onChange={() => {
                void toggleFormActive();
              }}
            />
          </div>
        </div>
        <form onSubmit={saveFormSettings}>
          <div className="field" style={{ maxWidth: "30rem" }}>
            <label htmlFor="edit-name">Display name</label>
            <input
              id="edit-name"
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={savingForm}>
              {savingForm ? "Saving..." : "Save form"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmDialog({ open: true, type: "delete-form", field: null })}
            >
              Delete form
            </button>
          </div>
        </form>
      </div>

      <div className="tab-row" style={{ alignItems: "center", display: "flex", gap: "0.75rem" }}>
        <Link to={`/admin/forms/${formId}/view`} className="btn btn-secondary btn-sm">
          Open view page
        </Link>
        <Link to={`/admin/forms/${formId}/submissions`} className="btn btn-primary btn-sm">
          View Submissions
        </Link>
      </div>

      <div className="card card-pad">
          {!form.isActive ? (
            <div className="alert alert-error">
              Form is inactive, so fields are hidden. Activate the form to manage and view fields.
            </div>
          ) : (
            <>
              <h2 className="card-title" style={{ marginBottom: "1rem" }}>
                Fields
              </h2>
              {visibleFields.length === 0 ? (
                <p className="muted">No fields yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table form-fields-table">
                    <thead>
                      <tr>
                        <th className="drag-col" aria-label="Drag" />
                        <th>Label</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Required</th>
                        <th>Active</th>
                        <th className="table-actions-col" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleFields.map((f) => (
                        <tr
                          key={f._id}
                          draggable
                          onDragStart={() => setDragFieldId(f._id)}
                          onDragEnd={() => setDragFieldId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            void handleFieldDrop(f);
                          }}
                          style={{ cursor: "move" }}
                        >
                          <td className="drag-col">
                            <span className="drag-handle-icon" title="Drag to reorder" aria-label="Drag to reorder">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="8" cy="6.5" r="1.4" />
                                <circle cx="8" cy="12" r="1.4" />
                                <circle cx="8" cy="17.5" r="1.4" />
                                <circle cx="16" cy="6.5" r="1.4" />
                                <circle cx="16" cy="12" r="1.4" />
                                <circle cx="16" cy="17.5" r="1.4" />
                              </svg>
                            </span>
                          </td>
                          <td>{f.label}</td>
                          <td>{f.type}</td>
                          <td>{f.priority}</td>
                          <td>{f.required ? "Yes" : "No"}</td>
                          <td>
                            <ToggleSwitch
                              checked={Boolean(f.enabled)}
                              disabled={fieldTogglingId === f._id}
                              label={`Toggle ${f.label}`}
                              onChange={() => {
                                void toggleFieldEnabled(f);
                              }}
                            />
                          </td>
                          <td className="table-actions-col">
                            <div className="row-actions row-actions-tight" style={{ justifyContent: "flex-end" }}>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(f)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setConfirmDialog({ open: true, type: "delete-field", field: f })}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="divider" />
              <div className="card-header" style={{ marginBottom: "0.75rem" }}>
                <h3>Fields setup</h3>
                <button
                  type="button"
                  className="btn btn-theme-primary btn-sm"
                  onClick={() => setShowAddFieldForm((prev) => !prev)}
                >
                  {showAddFieldForm ? "Hide Add Field" : "Form Add Field"}
                </button>
              </div>
              {showAddFieldForm ? (
                <form onSubmit={addField}>
                <div className="grid-2">
                  <div className="field">
                    <label>Label</label>
                    <input
                      className={`input ${newFieldErrors.label ? "field-control-error" : ""}`}
                      value={newField.label}
                      onChange={(e) => setNewField((prev) => ({ ...prev, label: e.target.value }))}
                      required
                    />
                    {newFieldErrors.label ? (
                      <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                        {newFieldErrors.label}
                      </p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label>Type</label>
                    <select
                      className="select"
                      value={newField.type}
                      onChange={(e) => setNewField((prev) => ({ ...prev, type: e.target.value }))}
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
                    {freePriorityHint ? (
                      <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem", lineHeight: 1.4 }}>
                        {freePriorityHint}
                      </p>
                    ) : null}
                    <input
                      className={`input ${newFieldErrors.priority ? "field-control-error" : ""}`}
                      type="number"
                      min={1}
                      value={newField.priority}
                      onChange={(e) => setNewField((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                      required
                    />
                    {newFieldErrors.priority ? (
                      <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                        {newFieldErrors.priority}
                      </p>
                    ) : null}
                  </div>
                </div>
                {["text", "alphanumeric", "textarea", "email", "password"].includes(newField.type) ? (
                  <div className="grid-2">
                    <div className="field">
                      <label>Min length (optional)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={newField.minLength}
                        onChange={(e) => setNewField((prev) => ({ ...prev, minLength: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Max length (optional)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={newField.maxLength}
                        onChange={(e) => setNewField((prev) => ({ ...prev, maxLength: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}

                {newField.type === "password" ? (
                  <div className="stack" style={{ gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div className="grid-2">
                      <div className="field">
                        <label>Min Uppercase Characters</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={newField.passwordMinUppercase}
                          onChange={(e) => setNewField((prev) => ({ ...prev, passwordMinUppercase: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label>Min Lowercase Characters</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={newField.passwordMinLowercase}
                          onChange={(e) => setNewField((prev) => ({ ...prev, passwordMinLowercase: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label>Min Digits (0-9)</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={newField.passwordMinDigits}
                          onChange={(e) => setNewField((prev) => ({ ...prev, passwordMinDigits: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label>Min Special Characters</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={newField.passwordMinSpecial}
                          onChange={(e) => setNewField((prev) => ({ ...prev, passwordMinSpecial: e.target.value }))}
                        />
                      </div>
                    </div>
                    <p className="muted password-hint" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0" }}>
                      {previewPasswordHint(newField)}
                    </p>
                  </div>
                ) : null}

                {newField.type === "dropdown" ? (
                  <div className="field">
                    <label>Dropdown values</label>
                    {newField.options.map((opt, idx) => (
                      <div key={idx} className="option-row option-row-single">
                        <input
                          className="input"
                          value={opt}
                          placeholder="e.g. Male"
                          onChange={(e) => {
                            const options = [...newField.options];
                            options[idx] = e.target.value;
                            setNewField((prev) => ({ ...prev, options }));
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setNewField((prev) => ({
                              ...prev,
                              options: prev.options.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setNewField((prev) => ({ ...prev, options: [...prev.options, ""] }))}
                    >
                      Add value
                    </button>
                  </div>
                ) : null}
                <label className="checkbox-row field">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField((prev) => ({ ...prev, required: e.target.checked }))}
                  />
                  Required
                </label>
                <label className="checkbox-row field">
                  <input
                    type="checkbox"
                    checked={newField.enabled}
                    onChange={(e) => setNewField((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  Field active
                </label>
                <button type="submit" className="btn btn-theme-primary" disabled={addingField}>
                  {addingField ? "Adding..." : "Add field"}
                </button>
                </form>
              ) : (
                <p className="muted">Click "Form Add Field" to open field form.</p>
              )}
            </>
          )}
        </div>

      {editOpen && editField ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !savingField && setEditOpen(false)}>
          <div className="modal card card-pad" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "1rem" }}>Edit field</h2>
            <form onSubmit={saveEditedField}>
              <div className="grid-2">
                <div className="field">
                  <label>Label</label>
                  <input
                    className={`input ${editFieldErrors.label ? "field-control-error" : ""}`}
                    value={editField.label}
                    onChange={(e) => setEditField((prev) => ({ ...prev, label: e.target.value }))}
                    required
                  />
                  {editFieldErrors.label ? (
                    <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                      {editFieldErrors.label}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    className="select"
                    value={editField.type}
                    onChange={(e) => setEditField((prev) => ({ ...prev, type: e.target.value }))}
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
                  {freePriorityHint ? (
                    <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.35rem", lineHeight: 1.4 }}>
                      {freePriorityHint}
                    </p>
                  ) : null}
                  <input
                    className={`input ${editFieldErrors.priority ? "field-control-error" : ""}`}
                    type="number"
                    min={1}
                    value={editField.priority}
                    onChange={(e) => setEditField((prev) => ({ ...prev, priority: e.target.value }))}
                    required
                  />
                  {editFieldErrors.priority ? (
                    <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                      {editFieldErrors.priority}
                    </p>
                  ) : null}
                </div>
              </div>

              {["text", "alphanumeric", "textarea", "email", "password"].includes(editField.type) ? (
                <div className="grid-2">
                  <div className="field">
                    <label>Min length</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={editField.minLength}
                      onChange={(e) => setEditField((prev) => ({ ...prev, minLength: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Max length</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={editField.maxLength}
                      onChange={(e) => setEditField((prev) => ({ ...prev, maxLength: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}

              {editField.type === "password" ? (
                <div className="stack" style={{ gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Min Uppercase Characters</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={editField.passwordMinUppercase}
                        onChange={(e) => setEditField((prev) => ({ ...prev, passwordMinUppercase: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Min Lowercase Characters</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={editField.passwordMinLowercase}
                        onChange={(e) => setEditField((prev) => ({ ...prev, passwordMinLowercase: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Min Digits (0-9)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={editField.passwordMinDigits}
                        onChange={(e) => setEditField((prev) => ({ ...prev, passwordMinDigits: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Min Special Characters</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={editField.passwordMinSpecial}
                        onChange={(e) => setEditField((prev) => ({ ...prev, passwordMinSpecial: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="muted password-hint" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0" }}>
                    {previewPasswordHint(editField)}
                  </p>
                </div>
              ) : null}

              {editField.type === "dropdown" ? (
                <div className="field">
                  <label>Dropdown values</label>
                  {editField.options.map((opt, idx) => (
                    <div key={idx} className="option-row option-row-single">
                      <input
                        className="input"
                        value={opt}
                        onChange={(e) => {
                          const options = [...editField.options];
                          options[idx] = e.target.value;
                          setEditField((prev) => ({ ...prev, options }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setEditField((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditField((prev) => ({ ...prev, options: [...prev.options, ""] }))}
                  >
                    Add value
                  </button>
                </div>
              ) : null}

              <label className="checkbox-row field">
                <input
                  type="checkbox"
                  checked={editField.required}
                  onChange={(e) => setEditField((prev) => ({ ...prev, required: e.target.checked }))}
                />
                Required
              </label>
              <label className="checkbox-row field">
                <input
                  type="checkbox"
                  checked={editField.enabled}
                  onChange={(e) => setEditField((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Active
              </label>
              <div className="row-actions" style={{ marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary" disabled={savingField}>
                  {savingField ? "Saving..." : "Save field"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <CenterNotice
        open={centerNotice.open}
        message={centerNotice.message}
        title="Priority updated"
        onDismiss={() => setCenterNotice({ open: false, message: "" })}
      />

      <CustomDialog
        open={confirmDialog.open}
        title={confirmDialog.type === "delete-form" ? "Delete form" : "Delete field"}
        message={
          confirmDialog.type === "delete-form"
            ? `Delete "${form?.name || ""}" and all fields? This action cannot be undone.`
            : `Delete field "${confirmDialog.field?.label || ""}"?`
        }
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={confirmLoading}
        onCancel={() => setConfirmDialog({ open: false, type: null, field: null })}
        onConfirm={() => {
          if (confirmDialog.type === "delete-form") {
            void deleteForm();
            return;
          }
          if (confirmDialog.type === "delete-field" && confirmDialog.field) {
            void deleteField(confirmDialog.field);
          }
        }}
      />
    </div>
  );
}
