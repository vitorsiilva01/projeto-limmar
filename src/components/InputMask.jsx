import React from 'react';
import ReactInputMask from 'react-input-mask';

export function MaskedInput({ mask, value, onChange, placeholder, className, id, label, type = "text", required = false, ...props }) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <ReactInputMask
        mask={mask}
        value={value}
        onChange={onChange}
        className={`form-control ${className || ''}`}
        id={id}
        placeholder={placeholder}
        type={type}
        required={required}
        {...props}
      />
    </div>
  );
}