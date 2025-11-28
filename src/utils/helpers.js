// utils/helpers.js
export const validateCPF = (cpf) => {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, "");

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf[9])) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf[10])) return false;

  return true;
};

export const initializeMockData = () => {
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify([{ id: 1, name: "Admin User", cpf: "12345678909", password: "admin123" }]));
  }
  if (!localStorage.getItem("tools")) {
    localStorage.setItem("tools", JSON.stringify([
      { id: 1, code: "FERR-001", description: "Fresa CNC Precision" },
      { id: 2, code: "FERR-002", description: "Broca Diamantada" },
      { id: 3, code: "FERR-003", description: "Serra Circular" },
    ]));
  }
  if (!localStorage.getItem("production_records")) {
    localStorage.setItem("production_records", JSON.stringify([]));
  }
  if (!localStorage.getItem("tool_failures")) {
    localStorage.setItem("tool_failures", JSON.stringify([]));
  }
};

export const calculateAccumulatedPieces = (toolId, datetime) => {
  const failures = JSON.parse(localStorage.getItem("tool_failures") || "[]");
  const records = JSON.parse(localStorage.getItem("production_records") || "[]");

  const lastFailure = failures
    .filter((f) => f.tool_id === toolId && new Date(f.failure_datetime) < new Date(datetime))
    .sort((a, b) => new Date(b.failure_datetime) - new Date(a.failure_datetime))[0];

  const startDate = lastFailure ? new Date(lastFailure.failure_datetime) : new Date(0);
  const relevantRecords = records.filter((r) => new Date(r.entry_datetime) > startDate && new Date(r.entry_datetime) <= new Date(datetime));
  return relevantRecords.reduce((sum, r) => sum + r.pieces, 0);
};
