import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { CustomDialog } from "../components/CustomDialog";
import { pickUniqueFieldKey } from "../utils/formKey";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "password", label: "Password" },
  { value: "dropdown", label: "Dropdown" },
];

const TAB = {
  BUILDER: "builder",
  ENTRIES: "entries",
};

export function AdminFormDetailPage() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [tab, setTab] = useState(searchParams.get("tab") === "entries" ? TAB.ENTRIES : TAB.BUILDER);
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
  });
  const [addingField, setAddingField] = useState(false);
  const [newFieldErrors, setNewFieldErrors] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editField, setEditField] = useState(null);
  const [savingField, setSavingField] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, field: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const nextPriority = useMemo(() => {
    if (!fields.length) return 1;
    return Math.max(...fields.map((x) => x.priority || 0)) + 1;
  }, [fields]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
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
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setNewField((prev) => ({ ...prev, priority: nextPriority }));
  }, [nextPriority]);

  async function loadEntries() {
    try {
      const res = await api(`/api/admin/forms/${formId}/submissions`);
      setEntries(Array.isArray(res?.submissions) ? res.submissions : []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (tab === TAB.ENTRIES) {
      loadEntries();
    }
  }, [tab]);

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
    if (["text", "textarea", "email"].includes(state.type)) {
      if (state.minLength !== "") body.minLength = Number(state.minLength);
      if (state.maxLength !== "") body.maxLength = Number(state.maxLength);
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
      const created = await api(`/api/admin/forms/${formId}/fields`, {
        method: "POST",
        body: JSON.stringify(createFieldPayload(newField)),
      });
      setFields((prev) => [...prev, created].sort((a, b) => a.priority - b.priority));
      setNewField({
        label: "",
        type: "text",
        enabled: true,
        priority: nextPriority + 1,
        required: false,
        minLength: "",
        maxLength: "",
        options: ["", ""],
      });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setNewFieldErrors((prev) => ({ ...prev, label: "This field already exists." }));
      }
      if (err.message && err.message.toLowerCase().includes("priority")) {
        setNewFieldErrors({ priority: "This priority is already used. Please select another." });
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
      priority: field.priority,
      required: Boolean(field.required),
      minLength: field.minLength ?? "",
      maxLength: field.maxLength ?? "",
      options: field.options?.length ? field.options.map((o) => o.label) : ["", ""],
      fieldKey: field.fieldKey,
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

      const body = {
        label: editField.label.trim(),
        type: editField.type,
        enabled: editField.enabled,
        priority: Number(editField.priority),
        required: editField.required,
      };
      if (["text", "textarea", "email"].includes(editField.type)) {
        if (editField.minLength !== "") body.minLength = Number(editField.minLength);
        if (editField.maxLength !== "") body.maxLength = Number(editField.maxLength);
      }
      if (editField.type === "dropdown") {
        body.options = editField.options
          .filter((opt) => opt.trim())
          .map((opt) => ({ label: opt.trim(), value: opt.trim().toLowerCase().replace(/\s+/g, "-") }));
      } else {
        body.options = [];
      }

      const updated = await api(`/api/admin/fields/${editField._id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setFields((prev) => prev.map((f) => (f._id === updated._id ? updated : f)).sort((a, b) => a.priority - b.priority));
      setEditOpen(false);
      setEditField(null);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setEditFieldErrors((prev) => ({ ...prev, label: "This field already exists." }));
      }
      if (err.message && err.message.toLowerCase().includes("priority")) {
        setEditFieldErrors({ priority: "This priority is already used. Please select another." });
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
  const entryColumns = fields.map((field) => field.fieldKey);
  const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));

  function formatEntryValue(key, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return "—";
    }

    const field = fieldByKey.get(key);
    const normalized = `${field?.fieldKey || key} ${field?.label || ""}`.toLowerCase();
    const isPasswordLike = field?.type === "password" || normalized.includes("password");
    if (isPasswordLike) {
      const text = String(rawValue);
      return text.length <= 5 ? text : `${text.slice(0, 5)}...`;
    }

    return String(rawValue);
  }

  return (
    <div className="stack">
      <p className="muted" style={{ marginBottom: "0.25rem" }}>
        <Link to="/admin/forms">← All forms</Link>
      </p>
      <section className="page-hero page-hero-compact">
        <h1 className="page-hero-title">{form.name}</h1>
        <p className="page-hero-lead">
          Manage form settings, preview final structure, and check user entries from one place.
        </p>
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

      <div className="tab-row">
        <button
          type="button"
          className={`tab-btn ${tab === TAB.BUILDER ? "tab-btn-active" : ""}`}
          onClick={() => setTab(TAB.BUILDER)}
        >
          Builder
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === TAB.ENTRIES ? "tab-btn-active" : ""}`}
          onClick={() => setTab(TAB.ENTRIES)}
        >
          Entries
        </button>
        <Link to={`/admin/forms/${formId}/view`} className="btn btn-secondary btn-sm">
          Open View Page
        </Link>
      </div>

      {tab === TAB.BUILDER ? (
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
                  <table className="table">
                    <thead>
                      <tr>
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
                        <tr key={f._id}>
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
                  className="btn btn-primary btn-sm"
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
                {["text", "textarea", "email"].includes(newField.type) ? (
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
                <button type="submit" className="btn btn-primary" disabled={addingField}>
                  {addingField ? "Adding..." : "Add field"}
                </button>
                </form>
              ) : (
                <p className="muted">Click "Form Add Field" to open field form.</p>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === TAB.ENTRIES ? (
        <div className="card card-pad">
          <div className="card-header">
            <h2 className="card-title">Entries</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadEntries}>
              Refresh
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="muted">No entries yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table entries-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Submitted At</th>
                    {entryColumns.map((key) => (
                      <th key={key}>{String(key).replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={entry._id}>
                      <td>{idx + 1}</td>
                      <td>{new Date(entry.createdAt).toLocaleString("en-GB")}</td>
                      {entryColumns.map((key) => {
                        const payload = entry?.payload && typeof entry.payload === "object" ? entry.payload : {};
                        const value = payload[key];
                        return (
                          <td key={`${entry._id}-${key}`}>
                            {formatEntryValue(key, value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

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
                  <input
                    className={`input ${editFieldErrors.priority ? "field-control-error" : ""}`}
                    type="number"
                    min={1}
                    value={editField.priority}
                    onChange={(e) => setEditField((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                    required
                  />
                  {editFieldErrors.priority ? (
                    <p style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                      {editFieldErrors.priority}
                    </p>
                  ) : null}
                </div>
              </div>

              {["text", "textarea", "email"].includes(editField.type) ? (
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

      <CustomDialog
        open={confirmDialog.open}
        title={confirmDialog.type === "delete-form" ? "Delete form" : "Delete field"}
        message={
          confirmDialog.type === "delete-form"
            ? `Delete "${form?.name || ""}" and all fields/submissions? This action cannot be undone.`
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
