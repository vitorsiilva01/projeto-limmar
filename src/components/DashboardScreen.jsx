import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend
);

function DashboardScreen({ apiBase, token }) {
  // (removido) estados duplicados: métricas e productionData são computados a partir de liveRecords
  const [tools, setTools] = useState([]);
  const [liveRecords, setLiveRecords] = useState([]);
  const [liveTools, setLiveTools] = useState([]);
  const [liveFailures, setLiveFailures] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados de configuração e thresholds
  // usamos apenas o valor inicial de config por enquanto (sem setter) para evitar aviso de variável não usada
  const [config] = useState({
    pieceThreshold: 500, // Limite de peças por ferramenta
    warningThreshold: 80, // Porcentagem para alerta de vida útil
    refreshInterval: 30000, // Intervalo de atualização em ms
  });
  
  const [perRecordThreshold, setPerRecordThreshold] = useState(1000);
  const [accumThreshold, setAccumThreshold] = useState(5000);
  // Função para carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = { Authorization: `Bearer ${token}` };
      const [recordsRes, toolsRes] = await Promise.all([
        fetch(`${apiBase.replace(/\/$/, '')}/api/records`, { headers }),
        fetch(`${apiBase.replace(/\/$/, '')}/api/tools`, { headers })
      ]);

      if (!recordsRes.ok || !toolsRes.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const records = await recordsRes.json();
      const tools = await toolsRes.json();

      setTools(tools);
      // se o endpoint de registros retornar dados, use-os como liveRecords iniciais
      if (Array.isArray(records) && records.length) {
        setLiveRecords(records);
      }

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message);
      setLoading(false);
    }
  }, [apiBase, token]);

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, config.refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, config.refreshInterval]);
  useEffect(() => {
    setLiveTools(tools || []);
  }, [tools]);

  useEffect(() => {
    // try SSE first
    let es;
    try {
      // use apiBase when available (falls back to absolute host if not set)
      const streamUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/stream` : 'http://localhost:3001/api/stream';
      es = new EventSource(streamUrl);
      es.addEventListener('record_created', (e) => {
        const data = JSON.parse(e.data);
        setLiveRecords((prev) => [data, ...prev]);
        // per-record threshold check
        if ((data.pieces || 0) >= perRecordThreshold) {
          const msg = `Registro com alto número de peças: ${data.pieces} (Ferramenta ${data.tool_id})`;
          setAlerts((a) => [{ type: 'warning', severity: 'warning', message: msg, at: new Date().toISOString() }, ...a]);
          // play notification
          playBeep('warning');
        }
      });
      es.addEventListener('failure_created', (e) => {
        const data = JSON.parse(e.data);
        setLiveFailures((prev) => [data, ...prev]);
        setAlerts((a) => [{ type: 'failure', severity: 'critical', message: `Falha na ferramenta ${data.tool_id}: ${data.reason || 'sem motivo'}`, at: new Date().toISOString() }, ...a]);
        playBeep('critical');
      });
      es.addEventListener('tool_created', (e) => {
        const data = JSON.parse(e.data);
        setLiveTools((prev) => [data, ...prev]);
      });
    } catch (err) {
      console.warn('SSE not available', err);
      // ignore, will fallback to polling
    }

    // polling fallback
    const poll = setInterval(async () => {
      try {
        const recordsUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/records` : 'http://localhost:3001/api/records';
        const failuresUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/failures` : 'http://localhost:3001/api/failures';
        const r = await fetch(recordsUrl);
        if (r.ok) {
          const arr = await r.json();
          setLiveRecords(arr);
        }
        const f = await fetch(failuresUrl);
        if (f.ok) setLiveFailures(await f.json());
      } catch (e) {
        console.warn('Polling error', e);
      }
    }, 5000);

    return () => {
      if (es) es.close();
      clearInterval(poll);
    };
  }, [perRecordThreshold, apiBase]);
  // sound helper
  function playBeep(level = 'info') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = level === 'critical' ? 'sawtooth' : 'sine';
      o.frequency.value = level === 'critical' ? 880 : 440;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('Audio error', err);
    }
  }
  // Calcular métricas e dados de gráficos com useMemo
  const dashboardData = useMemo(() => {
    const today = new Date().toDateString();
    const recentRecords = [...liveRecords]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Agrupar registros por hora para o gráfico
    const last24Hours = [...Array(24)].map((_, i) => {
      const date = new Date();
      date.setHours(date.getHours() - i);
      return date.toISOString().split(':')[0];
    }).reverse();

    const hourlyData = last24Hours.map(hour => {
      const count = liveRecords.filter(r => r && r.created_at && typeof r.created_at === 'string' && r.created_at.startsWith(hour)).length;
      return {
        count
      };
    });

    // Agrupar peças por ferramenta para o gráfico
    const toolData = liveTools.map(tool => {
      const pieces = liveRecords
        .filter(r => r.tool_id === tool.id)
        .reduce((sum, r) => sum + (r.pieces || 0), 0);
      return {
        toolCode: tool.code,
        pieces
      };
    });

    const totalPieces = liveRecords.reduce((sum, r) => sum + (r.pieces || 0), 0);

    // Top ferramentas por peças
    const piecesByTool = liveTools.map(tool => {
      const pieces = liveRecords
        .filter(r => r.tool_id === tool.id)
        .reduce((sum, r) => sum + (r.pieces || 0), 0);
      return { tool, pieces };
    }).sort((a, b) => b.pieces - a.pieces).slice(0, 6);

    // vida útil (quando disponível)
    const toolLife = liveTools.map(t => {
      const lifePct = (t.max_life_cycles && t.total_life_cycles) ? Math.min(100, Math.round((t.total_life_cycles / t.max_life_cycles) * 100)) : null;
      return { id: t.id, code: t.code, description: t.description, lifePct };
    });

    return {
      totalRecords: liveRecords.length,
      totalPieces,
      todayRecords: liveRecords.filter(r => new Date(r.created_at).toDateString() === today).length,
      recentRecords,
      hourlyData,
      toolData,
      piecesByTool,
      toolLife
    };
  }, [liveRecords, liveTools]);

  // compute toolStats with useMemo so we can observe changes and trigger alerts
  const toolStats = useMemo(() => {
    return liveTools.map((tool) => {
      const toolRecords = liveRecords.filter((r) => r.tool_id === tool.id || r.tool_id === Number(tool.id));
      const toolFailures = liveFailures.filter((f) => f.tool_id === tool.id || f.tool_id === Number(tool.id));
      const lastFailure = toolFailures.sort(
        (a, b) => new Date(b.failure_datetime) - new Date(a.failure_datetime)
      )[0];

      const currentAccumulated = toolRecords
        .filter((r) => {
          if (!r || !r.entry_datetime) return false;
          if (!lastFailure || !lastFailure.failure_datetime) return true;
          try { return new Date(r.entry_datetime) > new Date(lastFailure.failure_datetime); } catch { return false; }
        })
        .reduce((sum, r) => sum + (r.pieces || 0), 0);

      // determine severity based on thresholds
      let severity = 'ok';
      if (lastFailure) severity = 'critical';
      else if (currentAccumulated >= accumThreshold) severity = 'warning';

      return {
        ...tool,
        currentAccumulated,
        lastFailureDate: lastFailure?.failure_datetime,
        status: lastFailure ? 'failed' : 'active',
        severity,
      };
    });
  }, [liveTools, liveRecords, liveFailures, accumThreshold]);


  // create alerts when tools become warning/critical
  useEffect(() => {
    toolStats.forEach((t) => {
      if (t.severity === 'critical') {
        const msg = `Ferramenta ${t.code} CRÍTICA — última falha: ${t.lastFailureDate ? new Date(t.lastFailureDate).toLocaleString() : 'N/A'}`;
        setAlerts((a) => [{ type: 'failure', severity: 'critical', message: msg, at: new Date().toISOString() }, ...a]);
        playBeep('critical');
      } else if (t.severity === 'warning') {
        const msg = `Ferramenta ${t.code} próxima do threshold — acumulado: ${t.currentAccumulated} peças`;
        setAlerts((a) => [{ type: 'warning', severity: 'warning', message: msg, at: new Date().toISOString() }, ...a]);
        playBeep('warning');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolStats.length]);

  // função para exportar CSV de registros


  return (
    <div className="dashboard-container">
      {loading && (
        <div className="info-banner">Carregando dados...</div>
      )}
      {error && (
        <div className="error-banner">Erro: {error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>Dashboard de Produção</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => loadData()}>Atualizar</button>
        </div>
      </div>

      <div className="dashboard-row" style={{ marginBottom: '2rem' }}>
        <div className="card top-card">
          <div className="card-title">Top Ferramentas (por peças)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Ferramenta</th>
                <th>Peças</th>
                <th>Vida útil</th>
              </tr>
            </thead>
            <tbody>
              {toolStats.map((tool, idx) => (
                <tr key={tool.id}>
                  <td>{idx + 1}</td>
                  <td>{tool.code} — {tool.description}</td>
                  <td>{tool.currentAccumulated} peças</td>
                  <td>{tool.lifeSpan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card status-card">
          <div className="card-title">Status das Ferramentas</div>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Acumulado Atual</th>
                <th>Última Falha</th>
              </tr>
            </thead>
            <tbody>
              {toolStats.map((tool) => (
                <tr key={tool.id}>
                  <td>{tool.code}</td>
                  <td>{tool.description}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {tool.status === 'active' ? (
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '8px', background: '#198754', color: 'white', fontWeight: 600 }}>Ativa</span>
                      ) : (
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '8px', background: 'crimson', color: 'white', fontWeight: 600 }}>Falhou</span>
                      )}
                      {tool.severity === 'warning' && <span style={{ padding: '0.15rem 0.45rem', borderRadius: '6px', background: '#ffc107', color: '#333', fontWeight: 600 }}>Atenção</span>}
                      {tool.severity === 'critical' && <span style={{ padding: '0.15rem 0.45rem', borderRadius: '6px', background: '#dc3545', color: 'white', fontWeight: 600 }}>Crítico</span>}
                    </div>
                  </td>
                  <td>{tool.currentAccumulated} peças</td>
                  <td>
                    {tool.lastFailureDate
                      ? new Date(tool.lastFailureDate).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Total de Registros</div>
          <div className="stat-number">{dashboardData.totalRecords}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total de Peças</div>
          <div className="stat-number">{dashboardData.totalPieces}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Registros Hoje</div>
          <div className="stat-number">{dashboardData.todayRecords}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ferramentas Ativas</div>
          <div className="stat-number">{toolStats.filter((t) => t.status === 'active').length}</div>
        </div>
      </div>


      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-title">Gráficos em Tempo Real</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="chart-small">
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Produção (últimos registros)</div>
            <Line
              data={{
                labels: liveRecords.slice(0, 20).map((r) => {
                  const time = (r && (r.entry_datetime || r.created_at)) || null;
                  try { return time ? new Date(time).toLocaleTimeString() : '-'; } catch { return '-'; }
                }).reverse(),
                datasets: [
                  {
                    label: 'Peças por registro',
                    data: liveRecords.slice(0, 20).map((r) => r.pieces || 0).reverse(),
                    borderColor: (() => {
                      const vals = liveRecords.slice(0,20).map(r=>r.pieces||0);
                      const max = vals.length ? Math.max(0, ...vals) : 0;
                      return max >= accumThreshold ? 'rgba(220,53,69,1)' : 'rgba(75,192,192,1)';
                    })(),
                    backgroundColor: (() => {
                      const vals = liveRecords.slice(0,20).map(r=>r.pieces||0);
                      const max = vals.length ? Math.max(0, ...vals) : 0;
                      return max >= accumThreshold ? 'rgba(220,53,69,0.2)' : 'rgba(75,192,192,0.2)';
                    })(),
                    tension: 0.3,
                  },
                ],
              }}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>

          <div className="chart-small">
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Acumulado por Ferramenta</div>
            <Bar
              data={{
                labels: toolStats.map((t) => `${t.code} — ${t.description}`),
                datasets: [
                  {
                    label: 'Acumulado até falha (peças)',
                    data: toolStats.map((t) => t.currentAccumulated || 0),
                    backgroundColor: toolStats.map(t => t.severity === 'critical' ? 'rgba(220,53,69,0.85)' : (t.severity === 'warning' ? 'rgba(255,193,7,0.85)' : 'rgba(153,102,255,0.6)')),
                  },
                ],
              }}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">Alertas em Tempo Real</div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            <label style={{ marginRight: '0.5rem' }}>Threshold acumulado:</label>
            <input type="number" value={accumThreshold} onChange={(e)=>setAccumThreshold(Number(e.target.value)||0)} style={{ width: '80px', marginRight: '1rem' }} />
            <label style={{ marginRight: '0.5rem' }}>Threshold/registro:</label>
            <input type="number" value={perRecordThreshold} onChange={(e)=>setPerRecordThreshold(Number(e.target.value)||0)} style={{ width: '80px' }} />
          </div>
        </div>
        <ul style={{ paddingLeft: '1rem' }}>
          {alerts.slice(0, 8).map((a, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.severity === 'critical' ? 'crimson' : (a.severity === 'warning' ? '#ffc107' : '#6c757d') }}></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.message}</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(a.at).toLocaleString()}</div>
              </div>
              <button className="btn btn-small" onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== i))}>Ignorar</button>
            </li>
          ))}
          {alerts.length === 0 && <li style={{ color: '#666', padding: '1rem' }}>Sem alertas</li>}
        </ul>
      </div>

      <div className="card">
        <div className="card-title">Registros Recentes</div>
        {dashboardData.recentRecords.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ferramenta</th>
                <th>Máquina</th>
                <th>Peças</th>
                <th>Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{(() => { const t = liveTools.find(x => x.id === r.tool_id); return t ? `${t.code} — ${t.description}` : `FERR-${r.tool_id}`; })()}</td>
                  <td>{r.machine}</td>
                  <td>{r.pieces}</td>
                  <td>{r.entry_datetime ? new Date(r.entry_datetime).toLocaleString("pt-BR") : (r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--dark-gray)" }}>
            Nenhum registro recente encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

export default DashboardScreen;
