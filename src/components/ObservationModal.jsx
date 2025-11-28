import React, { useEffect, useState } from "react";

function ObservationModal({ record, tools, observation, onObservationChange, onSave, onClose }) {
  const tool = tools.find((t) => t.id === record.tool_id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // small entrance delay so CSS transition plays
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function startClose() {
    setVisible(false);
    // wait for animation to finish before actually closing
    setTimeout(() => {
      onClose && onClose();
    }, 220);
  }

  return (
    <div className={`modal-overlay ${visible ? 'overlay-visible' : 'overlay-hidden'}`} onClick={(e)=>{ if(e.target === e.currentTarget) startClose(); }}>
      <div className={`modal ${visible ? 'modal-visible' : 'modal-hidden'}`}>
        <div className="modal-header">
          <h3 className="modal-title">Observação da Ferramenta</h3>
          <button className="modal-close" onClick={startClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41-1.41L12 9.17 7.11 4.29A1 1 0 0 0 5.7 5.7L10.59 10.6 5.7 15.5a1 1 0 1 0 1.41 1.41L12 12.41l4.89 4.5a1 1 0 0 0 1.41-1.41L13.41 10.6l4.89-4.89z"/></svg>
          </button>
        </div>

        <div className="form-group">
          <label>Ferramenta</label>
          <input
            type="text"
            className="form-control"
            value={tool ? `${tool.code} - ${tool.description}` : "N/A"}
            disabled
          />
        </div>

        <div className="form-group">
          <label>Registro</label>
          <input
            type="text"
            className="form-control"
            value={`ID: ${record.id} - ${record.machine} - ${record.pieces} peças`}
            disabled
          />
        </div>

        <div className="form-group">
          <label>Motivo da Falha/Observação</label>
          <textarea
            className="form-control"
            rows="4"
            value={observation}
            onChange={(e) => onObservationChange(e.target.value)}
            placeholder="Descreva o motivo da falha ou observações relevantes..."
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button className="btn" onClick={startClose} style={{ background: "var(--light-gray)" }}>
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={async () => {
              if (onSave) {
                await onSave();
              }
            }}
            disabled={!observation.trim()}
          >
            Salvar Observação
          </button>
        </div>
      </div>
    </div>
  );
}

export default ObservationModal;
