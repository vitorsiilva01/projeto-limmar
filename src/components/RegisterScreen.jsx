import React, { useState } from "react";
import Logo from "../assets/react.svg";
import { validateCPF } from "../utils/helpers";

function RegisterScreen({ onRegister, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !cpf || !password || !confirmPassword) {
      setError("Todos os campos são obrigatórios");
      return;
    }

    // Validar nome
    if (name.trim().length < 3) {
      setError("Nome deve ter no mínimo 3 caracteres");
      return;
    }
    if (!/^[a-zA-ZÀ-ÿ\s]*$/.test(name)) {
      setError("Nome deve conter apenas letras");
      return;
    }

    // Validar senha
    if (password.length < 8) {
      setError("Senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (!/[a-zA-Z]/.test(password)) {
      setError("Senha deve conter letras");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Senha deve conter números");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Senha deve conter caracteres especiais");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    // Validar CPF
    if (!validateCPF(cpf)) {
      setError("CPF inválido");
      return;
    }

    Promise.resolve(onRegister(name, cpf.replace(/\D/g, ""), password, confirmPassword)).then((ok) => {
      // onRegister now may return: true (success), a string (error message) or falsy
      if (ok === true) {
        setSuccess("Cadastro realizado com sucesso! Redirecionando para o login...");
        // Limpa os campos do formulário
        setName("");
        setCpf("");
        setPassword("");
        setConfirmPassword("");
        // Redireciona para o login após 2 segundos
        setTimeout(() => {
          onSwitchToLogin();
        }, 2000);
      } else if (typeof ok === 'string' && ok.length) {
        setError(ok);
      } else {
        setError("Erro ao realizar cadastro");
      }
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-logo-container">
        <img src={Logo} alt="Logo" className="auth-logo" />
      </div>

      <div className="auth-card">
        <h2 className="auth-title">Cadastro de Usuário</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Nome Completo</label>
            <input
              id="name"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome completo"
            />
          </div>

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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Senha</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua senha"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <button type="submit" className="btn-block">
            Cadastrar
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" onClick={onSwitchToLogin} className="btn-link">
            Já tem uma conta? Faça login
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
