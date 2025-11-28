import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O nome do seu repositório no GitHub
const repoName = "projeto-limmar";

export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`, // necessário para GitHub Pages
});
