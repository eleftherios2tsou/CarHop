export function Field({ label, hint, ...props }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <input className="input" {...props} />
      {hint ? <span className="fieldHint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({ label, hint, options = [], ...props }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <select className="input" {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="fieldHint">{hint}</span> : null}
    </label>
  );
}

export function TextAreaField({ label, hint, ...props }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <textarea className="input" rows={props.rows || 4} {...props} />
      {hint ? <span className="fieldHint">{hint}</span> : null}
    </label>
  );
}
