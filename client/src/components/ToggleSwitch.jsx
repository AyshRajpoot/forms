export function ToggleSwitch({ checked, onChange, disabled, id, label }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle-switch ${checked ? "toggle-switch-on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="toggle-switch-knob" />
    </button>
  );
}
