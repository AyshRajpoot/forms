export function CustomDialog({
  open,
  title,
  message,
  variant = "warning",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const isDanger = variant === "danger";
  const iconColor = isDanger ? "#b91c1c" : "#c2410c";

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !loading && onCancel?.()}>
      <div
        className="modal card card-pad custom-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-dialog-head">
          <span className="custom-dialog-icon" aria-hidden="true" style={{ color: iconColor }}>
            <svg viewBox="0 0 24 24">
              <path
                d="M12 2 2 20h20L12 2Zm0 6v6m0 4h.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2 id="custom-dialog-title">{title}</h2>
        </div>
        <p className="muted custom-dialog-message">{message}</p>
        <div className="row-actions custom-dialog-actions">
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${isDanger ? "btn-danger" : "btn-primary"}`} disabled={loading} onClick={onConfirm}>
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
