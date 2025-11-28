import React, { useState } from "react";
import Logo from "../assets/react.svg";
import { validateCPF } from "../utils/helpers";

function LoginScreen({ onLogin, onSwitchToRegister }) {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!cpf) {
      setError("CPF é obrigatório");
      return;
    }

    if (!password) {
      setError("Senha é obrigatória");
      return;
    }

    if (password.trim() === '') {
      setError("Senha não pode ser apenas espaços em branco");
      return;
    }

    if (!validateCPF(cpf)) {
      setError("CPF inválido");
      return;
    }

    // Mostra feedback de carregamento
    setError("");
    setIsLoading(true);
    
    // Tenta fazer login
    try {
      const result = await onLogin(cpf.replace(/\D/g, ""), password);
      
      // Se result é true, login foi bem sucedido
      // Se é uma string, é uma mensagem de erro
      if (result !== true) {
        setError(result || "Erro ao tentar fazer login");
      }
    } catch (err) {
      console.error('Login error:', err);
      setError("Erro ao tentar fazer login. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo-container">
        <img src={Logo} alt="Logo" className="auth-logo" />
      </div>
      
      <div className="auth-card">
        <h2 className="auth-title">Login no Sistema</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="cpf">CPF</label>
            <input
              id="cpf"
              type="text"
              className="form-control"
              value={cpf}
              onChange={(e) => {
                // Previne campo vazio
                if (!e.target.value) {
                  setCpf('');
                  return;
                }
                // Formata o CPF (000.000.000-00)
                const value = e.target.value.replace(/\D/g, '');
                let formattedValue = value;
                if (value.length > 3) formattedValue = value.replace(/^(\d{3})/, '$1.');
                if (value.length > 6) formattedValue = formattedValue.replace(/^(\d{3}\.)(\d{3})/, '$1$2.');
                if (value.length > 9) formattedValue = formattedValue.replace(/^(\d{3}\.\d{3}\.)(\d{3})/, '$1$2-');
                setCpf(formattedValue);
              }}
              placeholder="000.000.000-00"
              maxLength="14"
              inputMode="numeric"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button type="submit" className="btn-block" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" onClick={onSwitchToRegister} className="btn-link">
            Não tem conta? Cadastre-se aqui
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
