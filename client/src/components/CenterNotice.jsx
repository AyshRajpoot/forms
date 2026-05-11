/**
 * Small centered notice (replaces window.alert for non-blocking UI).
 */
export function CenterNotice({ open, title = "Priority updated", message, onDismiss, onCancel }) {
  if (!open || !message) return null;

  const handleCancel = onCancel ?? onDismiss;

  return (
    <div
      className="center-notice-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="center-notice-title"
      onClick={onDismiss}
    >
      <div className="card card-pad center-notice-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="center-notice-title" className="center-notice-title">
          {title}
        </h2>
        <p className="center-notice-text">{message}</p>
        <div className="center-notice-actions">
          <button type="button" className="btn btn-secondary btn-sm center-notice-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm center-notice-btn" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
