import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

const SUBMISSION_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function AdminSubmissionsPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterText, setFilterText] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [formData, fieldsData, submissionsData] = await Promise.all([
        api(`/api/admin/forms/${formId}`),
        api(`/api/admin/forms/${formId}/fields`),
        api(`/api/admin/forms/${formId}/submissions`),
      ]);
      setForm(formData);
      setFields(Array.isArray(fieldsData) ? fieldsData : []);
      setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [formId]);

  function submissionAnswers(sub) {
    if (sub?.answers && typeof sub.answers === "object") return sub.answers;
    if (sub?.data && typeof sub.data === "object") return sub.data;
    return {};
  }

  function isImageValue(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        typeof value.base64 === "string" &&
        typeof value.mimeType === "string" &&
        value.mimeType.startsWith("image/")
    );
  }

  function isDocumentValue(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        typeof value.base64 === "string" &&
        typeof value.mimeType === "string" &&
        !value.mimeType.startsWith("image/")
    );
  }

  function asSearchableText(value) {
    if (isImageValue(value) || isDocumentValue(value)) {
      return `${value.filename || "image"} ${value.mimeType}`;
    }
    return String(value);
  }

  function formatSubmissionDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return SUBMISSION_DATE_FORMATTER.format(date);
  }

  // Filter submissions by filterText
  const filteredSubmissions = useMemo(() => {
    if (!filterText.trim()) return submissions;
    const query = filterText.toLowerCase().trim();
    return submissions.filter((sub) => {
      // Search date or any answer value
      const dateStr = formatSubmissionDateTime(sub.createdAt).toLowerCase();
      if (dateStr.includes(query)) return true;

      const answers = submissionAnswers(sub);
      return Object.values(answers).some((val) =>
        asSearchableText(val).toLowerCase().includes(query)
      );
    });
  }, [submissions, filterText]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredSubmissions.length) return;

    // Headers: Date, followed by each field label
    const headers = ["Submission Date", ...fields.map((f) => f.label)];
    
    const rows = filteredSubmissions.map((sub) => {
      const date = sub.createdAt ? formatSubmissionDateTime(sub.createdAt) : "";
      const rowAnswers = fields.map((f) => {
        const val = submissionAnswers(sub)?.[f.fieldKey] ?? "";
        // Mask passwords
        if (f.type === "password" && val) {
          return "••••••••";
        }
        if (isImageValue(val) || isDocumentValue(val)) {
          return `"${String(val.filename || "image file").replace(/"/g, '""')}"`;
        }
        // Escape quotes
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      return [date, ...rowAnswers].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${form?.key || "form"}_submissions.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (!filteredSubmissions.length) return;
    const jsonString = JSON.stringify(filteredSubmissions, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${form?.key || "form"}_submissions.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="stack"><p className="muted">Loading submissions...</p></div>;
  }

  return (
    <div className="stack">
      <p className="muted" style={{ marginBottom: "0.25rem" }}>
        <Link to={`/admin/forms/${formId}`}>← Back to {form?.name || "Form"}</Link>
      </p>
      
      <section className="page-hero page-hero-compact">
        <h1 className="page-hero-title">Submissions ({submissions.length})</h1>
        <p className="page-hero-lead">
          Viewing responses collected for <strong>{form?.name}</strong>.
        </p>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card-pad">
        <div className="card-header submissions-toolbar" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div className="field" style={{ margin: 0, minWidth: "15rem", flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Search submissions..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="row-actions submissions-toolbar-actions">
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary btn-sm"
              disabled={filteredSubmissions.length === 0}
            >
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="btn btn-secondary btn-sm"
              disabled={filteredSubmissions.length === 0}
            >
              Export JSON
            </button>
            <button onClick={load} className="btn btn-secondary btn-sm">
              Refresh
            </button>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            {filterText ? "No submissions match your search filter." : "No responses have been submitted for this form yet."}
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="table entries-table submissions-table">
              <thead>
                <tr>
                  <th>Submission Date</th>
                  {fields.map((f) => (
                    <th key={f._id}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((sub) => (
                  <tr key={sub._id}>
                    <td className="muted submissions-date-cell" style={{ whiteSpace: "nowrap" }}>
                      {formatSubmissionDateTime(sub.createdAt)}
                    </td>
                    {fields.map((f) => {
                      const value = submissionAnswers(sub)?.[f.fieldKey];
                      return (
                        <td key={f._id} className="submissions-value-cell">
                          {f.type === "password" && value ? (
                            <span style={{ letterSpacing: "0.15em" }}>••••••••</span>
                          ) : isImageValue(value) ? (
                            <a
                              className="submissions-link"
                              href={`data:${value.mimeType};base64,${value.base64}`}
                              target="_blank"
                              rel="noreferrer"
                              title={value.filename || "Uploaded image"}
                            >
                              View image
                            </a>
                          ) : isDocumentValue(value) ? (
                            <a
                              className="submissions-link"
                              href={`data:${value.mimeType};base64,${value.base64}`}
                              download={value.filename || "uploaded-file"}
                              title={value.filename || "Uploaded file"}
                            >
                              Download file
                            </a>
                          ) : value !== undefined && value !== null ? (
                            String(value)
                          ) : (
                            <span className="muted">—</span>
                          )}
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
    </div>
  );
}
