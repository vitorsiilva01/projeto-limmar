import React, { useState } from "react";
import "./ToolsScreen.css";

function ToolsScreen({ tools = [], onAddTool, onEditTool, onDeleteTool, onBack }) {
  const initialFormData = {
    code: "",
    description: "",
    brand: "",
    type: "",
    diameter: "",
    length: "",
    material: "",
    coating: "",
    max_rpm: "",
    cutting_edges: "",
    notes: ""
  };

  const [formData, setFormData] = useState(initialFormData);
  const [editingTool, setEditingTool] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toolToDelete, setToolToDelete] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const validateForm = () => {
    setError("");

    if (!formData.code || !formData.description) {
      setError("Código e descrição são obrigatórios");
      return false;
    }

    if (formData.diameter && isNaN(formData.diameter)) {
      setError("Diâmetro deve ser um número");
      return false;
    }

    if (formData.length && isNaN(formData.length)) {
      setError("Comprimento deve ser um número");
      return false;
    }

    if (formData.max_rpm && isNaN(formData.max_rpm)) {
      setError("RPM máximo deve ser um número");
      return false;
    }

    if (formData.cutting_edges && isNaN(formData.cutting_edges)) {
      setError("Número de arestas deve ser um número");
      return false;
    }

    return true;
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    onAddTool({
      ...formData,
      diameter: formData.diameter ? Number(formData.diameter) : null,
      length: formData.length ? Number(formData.length) : null,
      max_rpm: formData.max_rpm ? Number(formData.max_rpm) : null,
      cutting_edges: formData.cutting_edges ? Number(formData.cutting_edges) : null
    });

    setFormData({
      code: "",
      description: "",
      brand: "",
      type: "",
      diameter: "",
      length: "",
      material: "",
      coating: "",
      max_rpm: "",
      cutting_edges: "",
      notes: ""
    });
  };

  // Details / edit / delete handlers
  const handleShowDetails = (tool) => {
    setSelectedTool(tool);
  };

  const handleCloseDetails = () => {
    setSelectedTool(null);
  };

  const handleStartEdit = (tool) => {
    setEditingTool(tool);
    setFormData({
      code: tool.code || "",
      description: tool.description || "",
      brand: tool.brand || "",
      type: tool.type || "",
      diameter: tool.diameter ?? "",
      length: tool.length ?? "",
      material: tool.material || "",
      coating: tool.coating || "",
      max_rpm: tool.max_rpm ?? "",
      cutting_edges: tool.cutting_edges ?? "",
      notes: tool.notes || ""
    });
    // Scroll to top of form for better UX (optional)
  try { window.scrollTo?.(0, 0); } catch { /* ignore */ }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!editingTool) return;

    const updated = {
      ...editingTool,
      ...formData,
      diameter: formData.diameter ? Number(formData.diameter) : null,
      length: formData.length ? Number(formData.length) : null,
      max_rpm: formData.max_rpm ? Number(formData.max_rpm) : null,
      cutting_edges: formData.cutting_edges ? Number(formData.cutting_edges) : null
    };

    try {
      if (onEditTool) await onEditTool(updated);
      setEditingTool(null);
      setFormData(initialFormData);
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar ferramenta');
    }
  };

  const handleStartDelete = (tool) => {
    setToolToDelete(tool);
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setToolToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = async () => {
    if (!toolToDelete) return;
    const id = toolToDelete.id;
    setShowDeleteConfirm(false);
    setToolToDelete(null);
    try {
      if (onDeleteTool) await onDeleteTool(id);
    } catch (err) {
      setError(err?.message || 'Erro ao excluir ferramenta');
    }
  };

  return (
    <div className="tools-container">
      <h1 className="page-title"><svg className="title-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.007 7.007 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 14.4 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.24-1.12.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.8a.5.5 0 0 0 .12.63L4.85 11a6.99 6.99 0 0 0 0 1.88L2.82 14.46a.5.5 0 0 0-.12.63l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.06.27.29.46.56.46h3.8c.27 0 .5-.19.56-.46l.36-2.54c.58-.24 1.12-.56 1.62-.94l2.39.96c.25.1.54.01.68-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>Gerenciar Ferramentas</h1>

      <div className="tools-grid">
        {/* Form Card */}
        <div className="card compact-card tools-card">
          <form onSubmit={editingTool ? handleEdit : handleAdd}>
            <div className="form-group">
              <label>Código</label>
              <input 
                className="form-control" 
                value={formData.code} 
                onChange={(e) => setFormData({...formData, code: e.target.value})} 
                placeholder="FERR-001" 
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input 
                className="form-control" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                placeholder="Fresa CNC Precision" 
              />
            </div>
            <div className="form-group">
              <label>Marca</label>
              <input 
                className="form-control" 
                value={formData.brand} 
                onChange={(e) => setFormData({...formData, brand: e.target.value})} 
                placeholder="Ex: Korloy" 
              />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select 
                className="form-control" 
                value={formData.type} 
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="" disabled selected>Selecionar</option>
                <option value="Fresa">Fresa</option>
                <option value="Broca">Broca</option>
                <option value="Insert">Insert</option>
                <option value="Alargador">Alargador</option>
                <option value="Mandril">Mandril</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Diâmetro (mm)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.01" 
                value={formData.diameter} 
                onChange={(e) => setFormData({...formData, diameter: e.target.value})} 
                placeholder="Ex: 10.00" 
              />
            </div>
            <div className="form-group">
              <label>Comprimento (mm)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.01" 
                value={formData.length} 
                onChange={(e) => setFormData({...formData, length: e.target.value})} 
                placeholder="Ex: 75.00" 
              />
            </div>
            <div className="form-group">
              <label>Material</label>
              <select 
                className="form-control" 
                value={formData.material} 
                onChange={(e) => setFormData({...formData, material: e.target.value})}
              >
                <option value="" disabled selected>Selecionar</option>
                <option value="Aço Rápido">Aço Rápido (HSS)</option>
                <option value="Metal Duro">Metal Duro</option>
                <option value="Aço">Aço</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Revestimento</label>
              <select 
                className="form-control" 
                value={formData.coating} 
                onChange={(e) => setFormData({...formData, coating: e.target.value})}
              >
                <option value="" disabled selected>Selecionar</option>
                <option value="TiN">TiN</option>
                <option value="TiCN">TiCN</option>
                <option value="TiAlN">TiAlN</option>
                <option value="AlCrN">AlCrN</option>
                <option value="PVD">PVD</option>
                <option value="CVD">CVD</option>
                <option value="Nenhum">Nenhum</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label>RPM Máximo</label>
              <input 
                className="form-control" 
                type="number" 
                value={formData.max_rpm} 
                onChange={(e) => setFormData({...formData, max_rpm: e.target.value})} 
                placeholder="Ex: 12000" 
              />
            </div>
            <div className="form-group">
              <label>Número de Arestas</label>
              <input 
                className="form-control" 
                type="number" 
                value={formData.cutting_edges} 
                onChange={(e) => setFormData({...formData, cutting_edges: e.target.value})} 
                placeholder="Ex: 4" 
              />
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea 
                className="form-control" 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="Observações adicionais sobre a ferramenta..." 
                rows={3}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn btn-ghost" onClick={onBack}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="icon-only"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                {editingTool ? 'Atualizar' : 'Adicionar'} Ferramenta
              </button>
            </div>
          </form>
        </div>

        {/* Tools List Card */}
        <div className="tools-form">
          <div className="sidebar-header">
            <input
              className="search-input"
              placeholder="Buscar por código, descrição ou marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar ferramentas"
            />
            <div className="count-badge">{tools.length}</div>
          </div>

          <div className="card-title">Ferramentas Cadastradas</div>
          <div className="sidebar-content">
            {(() => {
              const filtered = searchTerm.trim()
                ? tools.filter(t => 
                    t.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    t.type?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                : tools;

              if (filtered.length === 0) {
                return (
                  <div className="empty-state">
                    <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14h-2v-2h2v2zm0-4h-2V6h2v6z"/></svg>
                    <p className="empty-title">Nenhuma ferramenta encontrada</p>
                    <p className="empty-sub">{tools.length === 0 ? "Use o formulário acima para adicionar sua primeira ferramenta" : "Tente outros termos de busca"}</p>
                  </div>
                );
              }

              return (
                <ul className="tools-list">
                  {filtered.map((t) => (
                    <li key={t.id} className="tool-item">
                      <div className="tool-meta" onClick={() => handleShowDetails(t)}>
                        <div className="tool-code">{t.code}</div>
                        <div className="tool-desc">{t.description}</div>
                        <div className="tool-sub">{t.type || '-'} • {t.brand || '-'}</div>
                      </div>
                      <div className="tool-actions">
                        <button className="btn-icon" title="Detalhes" onClick={(e) => { e.stopPropagation(); handleShowDetails(t); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        </button>
                        <button className="btn-icon" title="Editar" onClick={(e) => { e.stopPropagation(); handleStartEdit(t); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button className="btn-icon btn-danger" title="Excluir" onClick={(e) => { e.stopPropagation(); handleStartDelete(t); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>

      {selectedTool && (
        <div className="modal-overlay" onClick={handleCloseDetails}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detalhes da Ferramenta</h3>
              <button className="modal-close" onClick={handleCloseDetails}>×</button>
            </div>
            <div className="modal-content">
              <div className="details-grid">
                <div>
                  <strong>Código:</strong>
                  <p>{selectedTool.code}</p>
                </div>
                <div>
                  <strong>Descrição:</strong>
                  <p>{selectedTool.description}</p>
                </div>
                <div>
                  <strong>Marca:</strong>
                  <p>{selectedTool.brand || '-'}</p>
                </div>
                <div>
                  <strong>Tipo:</strong>
                  <p>{selectedTool.type || '-'}</p>
                </div>
                <div>
                  <strong>Dimensões:</strong>
                  <p>{selectedTool.diameter ? `∅${selectedTool.diameter}${selectedTool.length ? ` x ${selectedTool.length}` : ''}mm` : '-'}</p>
                </div>
                <div>
                  <strong>Material:</strong>
                  <p>{selectedTool.material || '-'}</p>
                </div>
                <div>
                  <strong>Revestimento:</strong>
                  <p>{selectedTool.coating || '-'}</p>
                </div>
                <div>
                  <strong>RPM Máximo:</strong>
                  <p>{selectedTool.max_rpm || '-'}</p>
                </div>
                <div>
                  <strong>Arestas de Corte:</strong>
                  <p>{selectedTool.cutting_edges || '-'}</p>
                </div>
                <div className="full-width">
                  <strong>Observações:</strong>
                  <p>{selectedTool.notes || '-'}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleCloseDetails}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirmar Exclusão</h3>
              <button className="modal-close" onClick={handleCancelDelete}>×</button>
            </div>
            <div className="modal-content">
              <p>Tem certeza que deseja excluir a ferramenta "{toolToDelete?.code}"?</p>
              <p>Esta ação não pode ser desfeita.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleCancelDelete}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      
      </div>
    </div>
  );
}

export default ToolsScreen;
