import React, { useState, useRef } from 'react';

interface Props {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ label, values, onChange, placeholder }: Props) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  const remove = (val: string) => {
    onChange(values.filter((v) => v !== val));
  };

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div
        className="tag-input"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button
              type="button"
              className="tag-remove"
              onClick={(e) => { e.stopPropagation(); remove(v); }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
            if (e.key === 'Backspace' && !input && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={values.length === 0 ? (placeholder ?? 'Type and press Enter...') : ''}
        />
      </div>
    </div>
  );
}
