import React, { useEffect, useState } from "react";

function ReportsScreen({ tools = [], records = [], failures = [], apiBase, token }) {
  const [period, setPeriod] = useState("day");
  const [toolId, setToolId] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
    const API_BASE = apiBase || "http://localhost:3001";
    const authToken = token || null;

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (period) qs.set('period', period);
      if (toolId) qs.set('tool_id', toolId);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/reports/summary?${qs.toString()}`, { headers });
      if (!res.ok) throw new Error('no-backend');
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error(error);
      // fallback to client-side aggregation when backend unavailable
      const now = new Date();
      let since = new Date();
      if (period === 'day') since.setDate(now.getDate() - 1);
      else if (period === 'week') since.setDate(now.getDate() - 7);
      else if (period === 'month') since.setMonth(now.getMonth() - 1);
      else since = new Date(0);

      const filteredRecords = records.filter(r => new Date(r.created_at) >= since && (!toolId || String(r.tool_id) === String(toolId)));
      const totals = { total_records: filteredRecords.length, total_pieces: filteredRecords.reduce((s,r)=>s+(r.pieces||0),0) };

      const pieces_by_tool = tools.map(t => ({
        tool_id: t.id,
        code: t.code,
        description: t.description,
        pieces: filteredRecords.filter(r => String(r.tool_id) === String(t.id)).reduce((s,r)=>s+(r.pieces||0),0)
      })).sort((a,b)=>b.pieces-a.pieces);

      const filteredFailures = failures.filter(f => new Date(f.created_at) >= since && (!toolId || String(f.tool_id) === String(toolId)));
      const failures_by_tool = Object.values(filteredFailures.reduce((acc, f) => {
        acc[f.tool_id] = acc[f.tool_id] || { tool_id: f.tool_id, failures: 0 };
        acc[f.tool_id].failures += 1;
        return acc;
      }, {}));

      setSummary({ period, since: since.toISOString(), totals, pieces_by_tool, failures_by_tool });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, toolId]);

  const downloadCsv = async (type = 'records') => {
    try {
      const qs = new URLSearchParams();
      if (period) qs.set('period', period);
      if (toolId) qs.set('tool_id', toolId);
      qs.set('type', type);
      
      // Adiciona BOM para Excel reconhecer caracteres especiais
      const BOM = '\uFEFF';
      const headers = authToken ? { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'text/csv;charset=utf-8'
      } : {
        'Content-Type': 'text/csv;charset=utf-8'
      };

      const res = await fetch(`${API_BASE}/api/reports/export?${qs.toString()}`, { headers });
      if (!res.ok) throw new Error('Export failed');
      
      let csvText = await res.text();
      // Adiciona BOM e converte vírgulas para ponto e vírgula
      csvText = BOM + csvText.replace(/,/g, ';');
      
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const fileName = type === 'records' ? `Registros_Usinagem_${date}` : `Falhas_Usinagem_${date}`;
      a.download = `${fileName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Não foi possível exportar o CSV. Verifique se o servidor está rodando.');
    }
  };

  const totalRecords = summary ? summary.totals.total_records : records.length;
  const totalPieces = summary ? summary.totals.total_pieces : records.reduce((s, r) => s + (r.pieces || 0), 0);
  const activeTools = tools.filter((t) => !failures.find((f) => f.tool_id === t.id)).length;

  return (
    <div className="reports-container">
      <h1 className="page-title">Relatórios</h1>

      <div className="card">
        <div className="card-title">Filtro</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Período:
            <div className="select-wrapper">
              <select className="form-control select-custom" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="day">Últimas 24h</option>
                <option value="week">Última semana</option>
                <option value="month">Último mês</option>
                <option value="all">Tudo</option>
              </select>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Ferramenta:
            <div className={`select-wrapper`}>
              <select className="form-control select-custom" value={toolId} onChange={(e)=>setToolId(e.target.value)}>
                <option value="">Todas as Ferramentas</option>
                {tools.map(t => <option value={t.id} key={t.id}>{t.code} - {t.description}</option>)}
              </select>
            </div>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => downloadCsv('records')} className="export-button">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Exportar Registros
            </button>
            <button onClick={() => downloadCsv('failures')} className="export-button">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Exportar Falhas
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-title">Resumo Rápido</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem", padding: '0.75rem' }}>
          <div className="stat-card">
            <div className="stat-label">Total de Registros</div>
            <div className="stat-number">{loading ? '...' : totalRecords}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total de Peças</div>
            <div className="stat-number">{loading ? '...' : totalPieces}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ferramentas Ativas</div>
            <div className="stat-number">{activeTools}</div>
          </div>
        </div>

        <div style={{ padding: '0.75rem' }}>
          <h3>Acumulado de Peças por Ferramenta</h3>
          {summary && summary.pieces_by_tool && summary.pieces_by_tool.length ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {summary.pieces_by_tool.map(p => (
                <div key={p.tool_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <div>{p.code || p.tool_id} — <span style={{ color: 'var(--text-muted)' }}>{p.description || ''}</span></div>
                  <div style={{ fontWeight: 700 }}>{p.pieces} peças</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nenhum dado disponível para o período</p>
          )}

          <h3 style={{ marginTop: '0.75rem' }}>Falhas por Ferramenta</h3>
          {summary && summary.failures_by_tool && summary.failures_by_tool.length ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {summary.failures_by_tool.map(f => (
                <div key={f.tool_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <div>{(tools.find(t=>t.id===f.tool_id)?.code) || f.tool_id}</div>
                  <div style={{ fontWeight: 700 }}>{f.failures} falhas</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nenhuma falha registrada no período</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportsScreen;
