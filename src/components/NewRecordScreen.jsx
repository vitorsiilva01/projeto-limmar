import React, { useState } from "react";

function NewRecordScreen({ tools, onAddRecord, onCancel, onOpenTools }) {
  const [formData, setFormData] = useState({
    tool_id: "",
    machine: "",
    pieces: "",
    entry_datetime: "",
    exit_datetime: "",
  });
  const [errors, setErrors] = useState({});
  const [toolQuery, setToolQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!formData.tool_id) errs.tool_id = "Ferramenta é obrigatória";
    if (!formData.machine) errs.machine = "Máquina é obrigatória";
    if (!formData.pieces || formData.pieces < 0) errs.pieces = "Peças deve ser positivo";
    if (!formData.entry_datetime) errs.entry_datetime = "Data de entrada é obrigatória";
    if (!formData.exit_datetime) errs.exit_datetime = "Data de saída é obrigatória";

    if (formData.entry_datetime && formData.exit_datetime) {
      const entry = new Date(formData.entry_datetime);
      const exit = new Date(formData.exit_datetime);
      if (exit < entry) errs.exit_datetime = "Saída deve ser depois da entrada";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onAddRecord({
      ...formData,
      tool_id: parseInt(formData.tool_id),
      pieces: parseInt(formData.pieces),
      entry_datetime: new Date(formData.entry_datetime).toISOString(),
      exit_datetime: new Date(formData.exit_datetime).toISOString(),
    });

    setFormData({ tool_id: "", machine: "", pieces: "", entry_datetime: "", exit_datetime: "" });
    setErrors({});
  };

  return (
    <div className="new-record-container">
      <h1 className="page-title">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="title-icon"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Novo Registro de Produção
      </h1>

      <div className="card compact-card new-record-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="input-icon">
                  <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3.5a1 1 0 0 0-.82-.58l-1.7-.25a6.97 6.97 0 0 0-.64-1.55l.96-1.4a1 1 0 0 0-.18-1.27l-1.2-1.2a1 1 0 0 0-1.27-.18l-1.4.96c-.5-.25-1.03-.45-1.55-.64l-.25-1.7A1 1 0 0 0 12.5 2h-1a1 1 0 0 0-.98.86l-.25 1.7a6.97 6.97 0 0 0-1.55.64L7.32 4.24a1 1 0 0 0-1.27.18L4.85 5.62a1 1 0 0 0-.18 1.27l.96 1.4c-.25.5-.45 1.03-.64 1.55l-1.7.25A1 1 0 0 0 2 11.5v1a1 1 0 0 0 .86.98l1.7.25c.19.52.39 1.04.64 1.55l-.96 1.4a1 1 0 0 0 .18 1.27l1.2 1.2a1 1 0 0 0 1.27.18l1.4-.96c.5.25 1.03.45 1.55.64l.25 1.7a1 1 0 0 0 .98.86h1a1 1 0 0 0 .98-.86l.25-1.7c.52-.19 1.04-.39 1.55-.64l1.4.96a1 1 0 0 0 1.27-.18l1.2-1.2a1 1 0 0 0 .18-1.27l-.96-1.4c.25-.5.45-1.03.64-1.55l1.7-.25a1 1 0 0 0 .86-.98v-1z"/>
                </svg>
                Ferramenta *
              </label>
                <div className="tool-input-container">
                  <div className="tool-input-wrapper">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Digite código ou descrição da ferramenta"
                      value={toolQuery}
                      onChange={(e) => { setToolQuery(e.target.value); setShowDropdown(true); setActiveIndex(-1); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      onKeyDown={(e) => {
                        const filtered = tools.filter(t => {
                          const q = toolQuery.toLowerCase();
                          return !q || t.code.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                        });
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setActiveIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (activeIndex >= 0 && filtered[activeIndex]) {
                            const t = filtered[activeIndex];
                            setFormData((f) => ({ ...f, tool_id: t.id }));
                            setToolQuery(`${t.code} - ${t.description}`);
                            setShowDropdown(false);
                          }
                        }
                      }}
                    />
                    {showDropdown && (
                      <div className="autocomplete-list" role="listbox">
                        {tools.filter(t => {
                          const q = toolQuery.toLowerCase();
                          return !q || t.code.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                        }).slice(0, 8).map((t, idx) => (
                          <div
                            key={t.id}
                            role="option"
                            className={`autocomplete-item ${idx === activeIndex ? 'active' : ''}`}
                            onMouseDown={(ev) => { ev.preventDefault(); /* prevent blur */ }}
                            onClick={() => {
                              setFormData((f) => ({ ...f, tool_id: t.id }));
                              setToolQuery(`${t.code} - ${t.description}`);
                              setShowDropdown(false);
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{t.code}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t.description}{t.brand ? ` — ${t.brand}` : ''}</div>
                          </div>
                        ))}
                        {tools.filter(t => {
                          const q = toolQuery.toLowerCase();
                          return !q || t.code.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                        }).length === 0 && (
                          <div className="autocomplete-item">Nenhuma ferramenta encontrada</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {errors.tool_id && <div className="error">{errors.tool_id}</div>}
              </div>

            <div className="form-group">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="input-icon"><path d="M15 17v2h3v-2h-3zm3-8h-7v2h7V9zm0 4h-7v2h7v-2zm-11 0h-2v2h2v-2zm0-4h-2v2h2V9zm0-4h-2v2h2V5zm4 0v2h7V5h-7zm-4 8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
                Máquina *
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.machine}
                onChange={(e) => setFormData({ ...formData, machine: e.target.value })}
                placeholder="Ex: CNC-01"
              />
              {errors.machine && <div className="error">{errors.machine}</div>}
            </div>

            <div className="form-group">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="input-icon"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                Peças Produzidas *
              </label>
              <input
                type="number"
                className="form-control"
                value={formData.pieces}
                onChange={(e) => setFormData({ ...formData, pieces: e.target.value })}
                min="0"
              />
              {errors.pieces && <div className="error">{errors.pieces}</div>}
            </div>

            <div className="form-group">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="input-icon"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
                Data/Hora de Entrada *
              </label>
              <input
                type="datetime-local"
                className="form-control"
                value={formData.entry_datetime}
                onChange={(e) => setFormData({ ...formData, entry_datetime: e.target.value })}
              />
              {errors.entry_datetime && <div className="error">{errors.entry_datetime}</div>}
            </div>

            <div className="form-group">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="input-icon"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                Data/Hora de Saída *
              </label>
              <input
                type="datetime-local"
                className="form-control"
                value={formData.exit_datetime}
                onChange={(e) => setFormData({ ...formData, exit_datetime: e.target.value })}
              />
              {errors.exit_datetime && <div className="error">{errors.exit_datetime}</div>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="btn-icon"><path d="M18.3 5.71a1 1 0 0 0-1.41-1.41L12 9.17 7.11 4.29A1 1 0 0 0 5.7 5.7L10.59 10.6 5.7 15.5a1 1 0 1 0 1.41 1.41L12 12.41l4.89 4.5a1 1 0 0 0 1.41-1.41L13.41 10.6l4.89-4.89z"/></svg>
              Cancelar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onOpenTools && onOpenTools()}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3.5a1 1 0 0 0-.82-.58l-1.7-.25a6.97 6.97 0 0 0-.64-1.55l.96-1.4a1 1 0 0 0-.18-1.27l-1.2-1.2a1 1 0 0 0-1.27-.18l-1.4.96c-.5-.25-1.03-.45-1.55-.64l-.25-1.7A1 1 0 0 0 12.5 2h-1a1 1 0 0 0-.98.86l-.25 1.7c-.52.19-1.04.39-1.55.64l-1.4-.96a1 1 0 0 0-1.27.18l-1.2 1.2a1 1 0 0 0-.18 1.27l.96 1.4c-.25.5-.45 1.03-.64 1.55l-1.7.25A1 1 0 0 0 2 11.5v1a1 1 0 0 0 .86.98l1.7.25c.19.52.39 1.04.64 1.55l-.96 1.4a1 1 0 0 0 .18 1.27l1.2 1.2a1 1 0 0 0 1.27.18l1.4-.96c.5.25 1.03.45 1.55.64l.25 1.7a1 1 0 0 0 .98.86h1a1 1 0 0 0 .98-.86l.25-1.7c.52-.19 1.04-.39 1.55-.64l1.4.96a1 1 0 0 0 1.27-.18l1.2-1.2a1 1 0 0 0 .18-1.27l-.96-1.4c.25-.5.45-1.03.64-1.55l1.7-.25a1 1 0 0 0 .86-.98v-1z"/></svg>
              Gerenciar Ferramentas
            </button>
            <button type="submit" className="btn btn-primary">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="btn-icon"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
              Salvar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewRecordScreen;
