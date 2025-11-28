import React, { useState, useEffect, useCallback } from "react";
import LoginScreen from "./components/LoginScreen.jsx";
import RegisterScreen from "./components/RegisterScreen.jsx";
import DashboardScreen from "./components/DashboardScreen.jsx";
import RecordsScreen from "./components/RecordsScreen.jsx";
import NewRecordScreen from "./components/NewRecordScreen.jsx";
import ToolsScreen from "./components/ToolsScreen.jsx";
import ReportsScreen from "./components/ReportsScreen.jsx";
import { initializeMockData, validateCPF } from "./utils/helpers.js";
import reactLogo from './assets/react.svg';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [currentScreen, setCurrentScreen] = useState("login");
  const [tools, setTools] = useState([]);
  const [records, setRecords] = useState([]);
  const [failures, setFailures] = useState([]);
  const [toasts, setToasts] = useState([]);
  // pending deletes stored as { [key]: { timeoutId, item } }
  const pendingDeletes = React.useRef({});

  // Force frontend to use port 3001 by default; build-time env can override
  let API_BASE = "http://localhost:3001";
  try {
    if (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) API_BASE = import.meta.env.VITE_API_BASE;
  } catch {
    /* import.meta not available */
  }

  function showToast(message, opts = {}) {
    const id = Date.now() + Math.random();
    const t = { id, message, type: opts.type || 'info', action: opts.action };
    setToasts((s) => [t, ...s]);
    if (opts.duration !== 0) {
      const dur = opts.duration || 5000;
      setTimeout(() => setToasts((s) => s.filter(x => x.id !== id)), dur + 20);
    }
    return id;
  }

  function clearToast(id) {
    setToasts((s) => s.filter(x => x.id !== id));
  }

  const loadData = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [toolsRes, recordsRes, failuresRes] = await Promise.all([
        fetch(`${API_BASE}/api/tools`, { headers }),
        fetch(`${API_BASE}/api/records`, { headers }),
        fetch(`${API_BASE}/api/failures`, { headers }),
      ]);
      if (toolsRes.ok) setTools(await toolsRes.json());
      else setTools(JSON.parse(localStorage.getItem("tools") || "[]"));

      if (recordsRes.ok) setRecords(await recordsRes.json());
      else setRecords(JSON.parse(localStorage.getItem("production_records") || "[]"));

      if (failuresRes.ok) setFailures(await failuresRes.json());
      else setFailures(JSON.parse(localStorage.getItem("tool_failures") || "[]"));
    } catch {
      // fallback to localStorage if backend not available
      setTools(JSON.parse(localStorage.getItem("tools") || "[]"));
      setRecords(JSON.parse(localStorage.getItem("production_records") || "[]"));
      setFailures(JSON.parse(localStorage.getItem("tool_failures") || "[]"));
    }
  }, [token, API_BASE]);

  useEffect(() => {
    initializeMockData();
    loadData();
    const user = localStorage.getItem("currentUser");
    if (user) {
      setCurrentUser(JSON.parse(user));
      setCurrentScreen("dashboard");
    }
  }, [loadData]);




  const login = async (cpf, password) => {
    try {
      // try backend login
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se o backend retornar uma mensagem de erro específica, use-a
        if (data && data.error) {
          return data.error;
        }
        // Caso contrário, retorne uma mensagem padrão baseada no status
        if (response.status === 401) return "CPF ou senha incorretos";
        if (response.status === 400) return "Dados inválidos";
        return "Erro ao tentar fazer login";
      }

      // Verifica se os dados são válidos
      if (!data || !data.token) {
        return "Erro ao tentar fazer login: resposta inválida do servidor";
      }

      // Configura token e usuário
      const user = data.user || { id: data.id, name: data.name, cpf: data.cpf };
      
      // Salva dados de autenticação
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("token", data.token);
      
      // Atualiza o estado
      setToken(data.token);
      setCurrentUser(user);

      try {
        // Carrega os dados necessários
        await loadData();
        
        // Só muda para o dashboard depois de carregar os dados
        setCurrentScreen("dashboard");
        
        return true;
      } catch (error) {
        console.error('Erro ao carregar dados após login:', error);
        // Limpa os dados salvos em caso de erro
        localStorage.removeItem("currentUser");
        localStorage.removeItem("token");
        setToken(null);
        setCurrentUser(null);
        return "Erro ao carregar dados. Por favor, tente novamente.";
      }
    } catch (err) {
      console.error('Erro durante o login:', err);
      return "Erro de conexão. Por favor, tente novamente.";
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setToken(null);
    localStorage.removeItem('token');
    setCurrentScreen("login");
  };

  const register = (name, cpf, password, confirmPassword) => {
    // Validações do lado do cliente
    if (!name) return 'Nome é obrigatório';
    if (!cpf) return 'CPF é obrigatório';
    if (!password) return 'Senha é obrigatória';
    if (!confirmPassword) return 'Confirmação de senha é obrigatória';

    if (name.trim().length < 3) return 'Nome deve ter no mínimo 3 caracteres';
    if (!/^[a-zA-ZÀ-ÿ\s]*$/.test(name)) return 'Nome deve conter apenas letras';

    if (password !== confirmPassword) return 'As senhas não coincidem';
    if (password.length < 8) return 'Senha deve ter no mínimo 8 caracteres';
    if (!/[a-zA-Z]/.test(password)) return 'Senha deve conter letras';
    if (!/[0-9]/.test(password)) return 'Senha deve conter números';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Senha deve conter caracteres especiais';

    if (!validateCPF(cpf)) return 'CPF inválido';

    // Chamada ao backend
    return fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cpf, password }),
    })
      .then(async (r) => {
        // Tenta obter mensagem de erro específica do backend
        let body = null;
        try { 
          body = await r.json(); 
        } catch (error) { 
          console.error('Error parsing response:', error);
          throw new Error('Erro ao processar resposta do servidor');
        }

        if (!r.ok) {
          // Se o backend forneceu uma mensagem de erro específica
          if (body && (body.error || body.message)) {
            return body.error || body.message;
          }
          // Caso contrário, use mensagens padrão baseadas no status
          if (r.status === 400) return 'Dados inválidos';
          if (r.status === 401) return 'Não autorizado';
          if (r.status === 409) return 'CPF já cadastrado';
          return 'Erro ao realizar cadastro';
        }
        return body;
      })
      .then((data) => {
        if (!data) return 'Erro ao realizar cadastro: Resposta vazia do servidor';
        if (typeof data === 'string') return data; // é uma mensagem de erro
        if (!data.token) return 'Erro ao realizar cadastro: Token inválido';
        
        // Registro bem sucedido, mas não loga automaticamente
        // Apenas retorna true para indicar sucesso
        return true;
      })
      .catch((err) => {
        console.error('Register error:', err);
        if (err.message) return err.message;
        return 'Erro de conexão. Por favor, tente novamente.';
      });
  };

  const addProductionRecord = async (record) => {
    // Validações básicas
    if (!record.tool_id) {
      showToast('Ferramenta é obrigatória', { type: 'error' });
      return false;
    }
    if (!record.machine || typeof record.machine !== 'string' || record.machine.trim().length === 0) {
      showToast('Máquina é obrigatória', { type: 'error' });
      return false;
    }
    if (!record.pieces || record.pieces <= 0) {
      showToast('Número de peças deve ser maior que zero', { type: 'error' });
      return false;
    }

    // Verifica se a ferramenta existe
    const toolExists = tools.some(t => String(t.id) === String(record.tool_id));
    if (!toolExists) {
      showToast('Ferramenta não encontrada', { type: 'error' });
      return false;
    }

    // post to backend
    const payload = { 
      ...record,
      created_by: currentUser?.id,
      created_at: new Date().toISOString() 
    };
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(`${API_BASE}/api/records`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se o backend forneceu uma mensagem de erro
        if (data && data.error) {
          showToast(data.error, { type: 'error' });
          return false;
        }
        throw new Error(response.statusText);
      }

      setRecords((prev) => [data, ...prev]);
      showToast('Registro de produção adicionado com sucesso', { type: 'success' });
      return true;
    } catch (error) {
      console.error('Erro ao adicionar registro:', error);
      // Fallback para localStorage em caso de erro
      try {
        const newRecord = { 
          ...record, 
          id: records.length + 1, 
          created_by: currentUser?.id, 
          created_at: new Date().toISOString() 
        };
        const updated = [...records, newRecord];
        localStorage.setItem("production_records", JSON.stringify(updated));
        setRecords(updated);
        showToast('Registro salvo localmente', { type: 'warning' });
        return true;
      } catch (localError) {
        console.error('Erro ao salvar localmente:', localError);
        showToast('Erro ao salvar registro', { type: 'error' });
        return false;
      }
    }
  };

  const addTool = async (tool) => {
    // Validações básicas
    if (!tool.code || typeof tool.code !== 'string' || tool.code.trim().length === 0) {
      showToast('Código da ferramenta é obrigatório', { type: 'error' });
      return false;
    }
    if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      showToast('Descrição da ferramenta é obrigatória', { type: 'error' });
      return false;
    }

    const headersT = { "Content-Type": "application/json" };
    if (token) headersT.Authorization = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${API_BASE}/api/tools`, {
        method: "POST",
        headers: headersT,
        body: JSON.stringify(tool),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data && data.error) {
          showToast(data.error, { type: 'error' });
          return false;
        }
        throw new Error(response.statusText);
      }

      setTools((prev) => [data, ...prev]);
      showToast('Ferramenta adicionada com sucesso', { type: 'success' });
      return true;
    } catch (error) {
      console.error('Erro ao adicionar ferramenta:', error);
      // Fallback para localStorage em caso de erro
      try {
        const current = JSON.parse(localStorage.getItem("tools") || "[]");
        const newTool = { id: current.length + 1, ...tool, created_at: new Date().toISOString() };
        const updated = [...current, newTool];
        localStorage.setItem("tools", JSON.stringify(updated));
        setTools(updated);
        showToast('Ferramenta salva localmente', { type: 'warning' });
        return true;
      } catch (localError) {
        console.error('Erro ao salvar localmente:', localError);
        showToast('Erro ao salvar ferramenta', { type: 'error' });
        return false;
      }
    }
  };

  const handleDeleteRecord = (id) => {
    // soft delete: remove from UI and allow undo before calling backend
    const item = records.find(r => String(r.id) === String(id));
    if (!item) return;
    setRecords((prev) => prev.filter((r) => String(r.id) !== String(id)));
    const key = `record:${id}`;
    const timeoutId = setTimeout(async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/records/${id}`, { method: 'DELETE', headers });
        if (!res.ok) throw new Error('delete-failed');
        showToast('Registro excluído', { type: 'success', duration: 3000 });
      } catch {
        // restore on error
        setRecords((prev) => [item, ...prev]);
        showToast('Erro ao excluir registro', { type: 'error', duration: 5000 });
      }
      delete pendingDeletes.current[key];
    }, 7000);
    pendingDeletes.current[key] = { timeoutId, item };

    const toastId = showToast(`Registro ${id} removido.`, { type: 'info', duration: 7000, action: { label: 'Desfazer', onClick: () => {
      const pd = pendingDeletes.current[key];
      if (pd) {
        clearTimeout(pd.timeoutId);
        setRecords((prev) => [pd.item, ...prev]);
        delete pendingDeletes.current[key];
        clearToast(toastId);
        showToast('Ação desfeita', { type: 'success', duration: 2500 });
      }
    }}});
  };

  const editTool = async (tool) => {
    // Validações básicas
    if (!tool.code || typeof tool.code !== 'string' || tool.code.trim().length === 0) {
      showToast('Código da ferramenta é obrigatório', { type: 'error' });
      return false;
    }
    if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      showToast('Descrição da ferramenta é obrigatória', { type: 'error' });
      return false;
    }

    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${API_BASE}/api/tools/${tool.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(tool),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data && data.error) {
          showToast(data.error, { type: 'error' });
          return false;
        }
        throw new Error(response.statusText);
      }

      const updatedTool = await response.json();
      setTools(tools.map(t => t.id === tool.id ? updatedTool : t));
      showToast('Ferramenta atualizada com sucesso!', { type: 'success' });
      return true;

    } catch (error) {
      console.error('Error editing tool:', error);
      showToast('Erro ao atualizar ferramenta', { type: 'error' });
      return false;
    }
  };

  const addToolFailure = (failure) => {
    const headersF = { "Content-Type": "application/json" };
    if (token) headersF.Authorization = `Bearer ${token}`;
    fetch(`${API_BASE}/api/failures`, {
      method: "POST",
      headers: headersF,
      body: JSON.stringify(failure),
    })
      .then((r) => r.json())
      .then((created) => setFailures((prev) => [created, ...prev]))
      .catch(() => {
        const newFailure = { ...failure, id: failures.length + 1, created_by: currentUser?.id, created_at: new Date().toISOString() };
        const updated = [...failures, newFailure];
        localStorage.setItem("tool_failures", JSON.stringify(updated));
        setFailures(updated);
      });
  };

  const deleteTool = (id) => {
    // soft delete: remove from UI and allow undo before calling backend
    const item = tools.find(t => String(t.id) === String(id));
    if (!item) {
      showToast('Ferramenta não encontrada', { type: 'error' });
      return;
    }

    // Verifica se existem registros associados
    const hasRecords = records.some(r => String(r.tool_id) === String(id));
    const hasFailures = failures.some(f => String(f.tool_id) === String(id));
    if (hasRecords || hasFailures) {
      showToast('Não é possível excluir ferramenta com registros associados', { type: 'error' });
      return;
    }

    // Remove da UI
    setTools((prev) => prev.filter((t) => String(t.id) !== String(id)));
    const key = `tool:${id}`;
    const timeoutId = setTimeout(async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/tools/${id}`, { method: 'DELETE', headers });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorMsg = data.error || 'Erro ao excluir ferramenta';
          throw new Error(errorMsg);
        }

        showToast('Ferramenta excluída com sucesso', { type: 'success', duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir ferramenta:', error);
        // Restaura a ferramenta em caso de erro
        setTools((prev) => [item, ...prev]);
        showToast(error.message || 'Erro ao excluir ferramenta', { type: 'error', duration: 5000 });
      }
      delete pendingDeletes.current[key];
    }, 7000);

    pendingDeletes.current[key] = { timeoutId, item };

    const toastId = showToast(`Ferramenta ${id} removida.`, { type: 'info', duration: 7000, action: { label: 'Desfazer', onClick: () => {
      const pd = pendingDeletes.current[key];
      if (pd) {
        clearTimeout(pd.timeoutId);
        setTools((prev) => [pd.item, ...prev]);
        delete pendingDeletes.current[key];
        clearToast(toastId);
        showToast('Ação desfeita', { type: 'success', duration: 2500 });
      }
    }}});
  };

  return (
    <div className="app-layout">
      {currentUser && (
      <header className="app-header">
        <div className="container header-content">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={reactLogo} alt="React Logo" className="logo-small" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: 'var(--text-title)' }}>Usinagem Limmar</strong>
              <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Painel de Produção</small>
            </div>
          </div>
          <nav>
            <ul>
              <li>
                <a 
                  href="#" 
                  className={currentScreen === "dashboard" ? "active" : ""}
                  onClick={() => setCurrentScreen("dashboard")}
                >
                  <i className="fas fa-chart-line"></i>
                  Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={currentScreen === "records" ? "active" : ""}
                  onClick={() => setCurrentScreen("records")}
                >
                  <i className="fas fa-list"></i>
                  Registros
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={currentScreen === "new-record" ? "active" : ""}
                  onClick={() => setCurrentScreen("new-record")}
                >
                  <i className="fas fa-plus-circle"></i>
                  Novo Registro
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={currentScreen === "tools" ? "active" : ""}
                  onClick={() => setCurrentScreen("tools")}
                >
                  <i className="fas fa-wrench"></i>
                  Ferramentas
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={currentScreen === "reports" ? "active" : ""}
                  onClick={() => setCurrentScreen("reports")}
                >
                  <i className="fas fa-file-alt"></i>
                  Relatórios
                </a>
              </li>
              <li className="nav-divider"></li>
              <li>
                <a href="#" onClick={logout} className="nav-danger">
                  <i className="fas fa-sign-out-alt"></i>
                  Sair
                </a>
              </li>
            </ul>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentUser && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>{currentUser.name || currentUser.cpf}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{currentUser.role || ''}</div>
              </div>
            )}
          </div>
        </div>
      </header>
    )}

    <main className="main-content">
      <div className="container">
        {!currentUser ? (
          <>
            {currentScreen === "login" && <LoginScreen onLogin={login} onSwitchToRegister={() => setCurrentScreen("register")} />}
            {currentScreen === "register" && <RegisterScreen onRegister={register} onSwitchToLogin={() => setCurrentScreen("login")} />}
          </>
        ) : (
          <>
            {currentScreen === "dashboard" && (
              <DashboardScreen 
                apiBase={API_BASE} 
                token={token} 
              />
            )}
            {currentScreen === "records" && (
              <RecordsScreen 
                apiBase={API_BASE} 
                token={token}
                onDeleteRecord={handleDeleteRecord}
                onAddFailure={addToolFailure}
              />
            )}
            {currentScreen === "new-record" && (
              <NewRecordScreen 
                apiBase={API_BASE} 
                token={token}
                tools={tools}
                onAddRecord={addProductionRecord}
                onSuccess={() => {
                  showToast('Registro criado com sucesso!');
                  setCurrentScreen("records");
                }}
                onCancel={() => setCurrentScreen("records")}
                onOpenTools={() => setCurrentScreen('tools')}
              />
            )}
            {currentScreen === "tools" && (
              <ToolsScreen 
                tools={tools}
                onAddTool={addTool}
                onEditTool={editTool}
                onDeleteTool={deleteTool}
                onBack={() => setCurrentScreen("dashboard")}
              />
            )}
            {currentScreen === "reports" && (
              <ReportsScreen 
                apiBase={API_BASE} 
                token={token}
              />
            )}
          </>
        )}
      </div>
    </main>

    {/* Toasts */}
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div className="toast-message">{t.message}</div>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                try { t.action.onClick(); } catch { /* ignore */ }
                clearToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-close" onClick={() => clearToast(t.id)} aria-label="Fechar">×</button>
        </div>
      ))}
    </div>
  </div>
);
}

export default App;
