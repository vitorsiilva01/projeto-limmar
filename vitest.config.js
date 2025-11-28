import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,        // habilita describe/test/expect sem importar
    environment: "jsdom", // simula navegador para testes de DOM
    setupFiles: [],       // opcional (caso queira configs extras)
    css: false
  },
});
