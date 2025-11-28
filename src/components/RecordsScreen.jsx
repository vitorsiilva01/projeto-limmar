import React, { useState, useEffect } from "react";
import ObservationModal from "./ObservationModal";

function RecordsScreen({ apiBase, token, onDeleteRecord, onAddFailure }) {
  // Estados principais
  const [records, setRecords] = useState([]);
  const [tools, setTools] = useState([]);
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [observation, setObservation] = useState('');
  
  // Filtros e paginação
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTool, setSelectedTool] = useState("all");
  const [dateRange, _setDateRange] = useState({ start: '', end: '' });
  const [accumThreshold, setAccumThreshold] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Modal de observações
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [recordsRes, toolsRes] = await Promise.all([
          fetch(`${apiBase}/api/records`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiBase}/api/tools`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        // também busca falhas
        const failuresRes = await fetch(`${apiBase}/api/failures`, { headers: { Authorization: `Bearer ${token}` } });

        if (recordsRes.ok && toolsRes.ok) {
          const [recordsData, toolsData] = await Promise.all([
            recordsRes.json(),
            toolsRes.json()
          ]);

          setRecords(recordsData);
          setTools(toolsData);
        } else {
          setError('Erro ao carregar dados');
        }

        if (failuresRes && failuresRes.ok) {
          setFailures(await failuresRes.json());
        } else {
          // keep empty failures
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [apiBase, token]);
  // aplica filtros de busca, ferramenta e intervalo de datas
  const filteredRecords = records.filter((record) => {
    const q = searchTerm.trim().toLowerCase();
    const toolObj = tools.find(t => t.id === record.tool_id);
    const matchesSearch = !q || (
      String(record.id).includes(q) ||
      (record.machine || '').toLowerCase().includes(q) ||
      (toolObj?.code || '').toLowerCase().includes(q) ||
      (toolObj?.description || '').toLowerCase().includes(q)
    );
    const matchesTool = selectedTool === "all" || record.tool_id.toString() === selectedTool;
    let matchesDate = true;
    if (dateRange.start) {
      matchesDate = matchesDate && new Date(record.entry_datetime || record.created_at) >= new Date(dateRange.start + 'T00:00:00');
    }
    if (dateRange.end) {
      matchesDate = matchesDate && new Date(record.entry_datetime || record.created_at) <= new Date(dateRange.end + 'T23:59:59');
    }
    return matchesSearch && matchesTool && matchesDate;
  });

  // paginação simples
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddObservation = (record) => {
    setSelectedRecord(record);
    const failure = failures.find((f) => f.tool_id === record.tool_id);
    setObservation(failure?.reason || "");
    setShowModal(true);
  };

  const saveObservation = async () => {
    if (!selectedRecord) return;
    if (!observation.trim()) {
      // feedback para o operador caso o botão seja acionado por outro meio
      window.alert('Por favor, informe o motivo da falha antes de salvar.');
      return;
    }

    try {
      // Cria um objeto de falha local imediatamente (otimista) para atualizar a UI
      const localFailure = {
        id: `local-${Date.now()}`,
        tool_id: selectedRecord.tool_id,
        reason: observation,
        failure_datetime: new Date().toISOString(),
        // backend requires 'severity' field; usar valor padrão mínimo
        severity: 'low'
      };

      // Atualiza falhas e registros no front-end imediatamente
      setFailures((prev) => [...prev, localFailure]);

      const failureDate = new Date(localFailure.failure_datetime);
      const updatedRecords = records.map((r) => {
        if (r.tool_id === selectedRecord.tool_id) {
          const recordDate = new Date(r.entry_datetime || r.created_at);
          if (recordDate <= failureDate) {
            return { ...r, status: 'falhou' };
          }
        }
        return r;
      });
      setRecords(updatedRecords);

      // Tenta persistir no backend; se der certo, substitui a falha local pela do servidor
      try {
        const response = await fetch(`${apiBase}/api/failures`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            tool_id: localFailure.tool_id,
            reason: localFailure.reason,
            failure_datetime: localFailure.failure_datetime,
            severity: localFailure.severity
          })
        });

        if (response.ok) {
          const newFailure = await response.json();
          // Substituir a falha local pela resposta do servidor
          setFailures((prev) => prev.map((f) => (f.id === localFailure.id ? newFailure : f)));

          if (onAddFailure) onAddFailure(newFailure);
        } else {
          // caso o servidor retorne erro, informar o usuário (mantemos a atualização local para visibilidade)
          console.error('Erro ao persistir falha no servidor', response.status);
          window.alert('Falha ao salvar no servidor. A observação foi registrada localmente, tente novamente mais tarde.');
        }
      } catch (err) {
        console.error('Erro de rede ao salvar observação:', err);
        window.alert('Erro de rede ao salvar a observação. A observação foi registrada localmente.');
      }

      // Fechar modal e limpar estado
      setShowModal(false);
      setObservation("");
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
    }
  };

  const exportFilteredCsv = () => {
    const rows = filteredRecords.map(r => {
      const t = tools.find(x => x.id === r.tool_id) || {};
      const accumulated = computeAccumulatedPieces(r.tool_id, r.entry_datetime);
      return {
        id: r.id,
        tool_code: t.code || r.tool_id,
        tool_desc: t.description || '',
        machine: r.machine,
        pieces: r.pieces || 0,
        entry_datetime: r.entry_datetime || r.created_at || '',
        exit_datetime: r.exit_datetime || '',
        accumulated
      };
    });
    const header = ['id','tool_code','tool_desc','machine','pieces','entry_datetime','exit_datetime','accumulated'];
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `records_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const computeAccumulatedPieces = (toolId, entryDatetime) => {
    const entryDate = new Date(entryDatetime || new Date());

    // última falha antes da entrada (ponto de partida)
    const lastFailure = failures
      .filter((f) => f.tool_id === toolId && new Date(f.failure_datetime) < entryDate)
      .sort((a, b) => new Date(b.failure_datetime) - new Date(a.failure_datetime))[0];
    const startDate = lastFailure ? new Date(lastFailure.failure_datetime) : new Date(0);

    // verificar se existe uma falha (local ou do servidor) que ocorra no momento da entrada ou depois dela
    const nextFailure = failures
      .filter((f) => f.tool_id === toolId && new Date(f.failure_datetime) >= entryDate)
      .sort((a, b) => new Date(a.failure_datetime) - new Date(b.failure_datetime))[0];

    // se houver uma falha futura/igual, acumular até a falha; caso contrário, até a própria entrada
    const endDate = nextFailure ? new Date(nextFailure.failure_datetime) : entryDate;

    const relevantRecords = records.filter((r) => {
      const rd = new Date(r.entry_datetime || r.created_at || 0);
      return r.tool_id === toolId && rd > startDate && rd <= endDate;
    });

    return relevantRecords.reduce((sum, r) => sum + (r.pieces || 0), 0);
  };

  // Função saveObservation removida daqui pois já existe acima

  const handleDelete = (rec) => {
    const ok = window.confirm(`Excluir registro ${rec.id}? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    if (onDeleteRecord) onDeleteRecord(rec.id);
  };

  return (
    <div className="records-container">
      {loading && <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: 6, marginBottom: '1rem' }}>Carregando registros...</div>}
      {error && <div style={{ padding: '1rem', background: '#fdecea', borderRadius: 6, marginBottom: '1rem', color: '#842029' }}>{error}</div>}
      <h1 className="page-title">
        <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: "0.5rem" }}>
          <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,12.5A2.5,2.5 0 0,0 9.5,15A2.5,2.5 0 0,0 12,17.5A2.5,2.5 0 0,0 14.5,15A2.5,2.5 0 0,0 12,12.5M12,11A4,4 0 0,1 16,15A4,4 0 0,1 12,19A4,4 0 0,1 8,15A4,4 0 0,1 12,11Z" />
        </svg>
        Consulta de Registros
      </h1>

      <div className="search-bar">
        <div className="search-input">
          <div className="select-wrapper">
            <select 
              className="form-control"
              value={selectedTool} 
              onChange={(e) => setSelectedTool(e.target.value)}
              style={{ minWidth: "250px" }}
            >
              <option value="" disabled>Selecionar</option>
              <option value="all">Todas as ferramentas</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>{tool.code} - {tool.description}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por ID ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)' }}>Data início</label>
            <input type="date" className="form-control" value={dateRange.start} onChange={(e) => _setDateRange({ ...dateRange, start: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)' }}>Data fim</label>
            <input type="date" className="form-control" value={dateRange.end} onChange={(e) => _setDateRange({ ...dateRange, end: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)' }}>Threshold acumulado</label>
            <input type="number" className="form-control" style={{ width: 120 }} value={accumThreshold} onChange={(e) => setAccumThreshold(Number(e.target.value) || 0)} />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-small" onClick={exportFilteredCsv}>Exportar CSV</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ferramenta</th>
              <th>Descrição</th>
              <th>Máquina</th>
              <th>Peças</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Acumulado até Falha</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.map((r) => {
              const tool = tools.find((t) => t.id === r.tool_id);
              const accumulated = computeAccumulatedPieces(r.tool_id, r.entry_datetime);
              const hasRecentFailure = failures.some(f => f.tool_id === r.tool_id && new Date(f.failure_datetime) > new Date(r.entry_datetime || r.created_at));

              // Priorizar status explícito do registro (ex.: 'falhou') quando presente.
              let statusClass = (accumulated >= accumThreshold ? 'status-maintenance' : 'status-active');
              let statusLabel = (accumulated >= accumThreshold ? 'Atenção' : 'OK');

              if (r && r.status) {
                const st = String(r.status).toLowerCase();
                if (st === 'falhou') {
                  statusClass = 'status-inactive';
                  statusLabel = 'Falhou';
                } else if (st === 'falha') {
                  statusClass = 'status-inactive';
                  statusLabel = 'Falha';
                } else {
                  // qualquer outro status explícito, mostrar como está (capitalizando a primeira letra)
                  statusLabel = String(r.status).charAt(0).toUpperCase() + String(r.status).slice(1);
                }
              } else if (hasRecentFailure) {
                statusClass = 'status-inactive';
                statusLabel = 'Falha';
              }
              return (
                <tr key={r.id}>
                  <td>{tool?.code || `FERR-${r.tool_id}`}</td>
                  <td>{tool?.description || '-'}</td>
                  <td>{r.machine}</td>
                  <td>{r.pieces}</td>
                  <td>{r.entry_datetime ? new Date(r.entry_datetime).toLocaleString('pt-BR') : '-'}</td>
                  <td>{r.exit_datetime ? new Date(r.exit_datetime).toLocaleString('pt-BR') : '-'}</td>
                  <td>{accumulated} peças</td>
                  <td><span className={`status-badge ${statusClass}`}>{statusLabel}</span></td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-small btn-primary" onClick={() => handleAddObservation(r)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 6.5a2.5 2.5 0 0 0-2.5-2.5H5.5A2.5 2.5 0 0 0 3 6.5v7A2.5 2.5 0 0 0 5.5 16H8v3l3.5-3H18.5A2.5 2.5 0 0 0 21 13.5v-7z"/></svg>
                      Observação
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => handleDelete(r)} title="Excluir registro">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h4l1 1h4v2H4V4h4l1-1z"/></svg>
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRecords.length === 0 && (
          <p className="empty-state">Nenhum registro encontrado.</p>
        )}
        {filteredRecords.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <div style={{ color: '#666' }}>Página {currentPage} de {totalPages}</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-small" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <button className="btn btn-small" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ObservationModal
          record={selectedRecord}
          tools={tools}
          observation={observation}
          onObservationChange={setObservation}
          onSave={saveObservation}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default RecordsScreen;
