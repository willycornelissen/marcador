import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hasCname = fs.existsSync(path.resolve(__dirname, 'public/CNAME'))

// base: './' resolve os assets relativamente à própria página, então o build
// funciona em qualquer hospedagem (subpasta do GitHub Pages ou domínio próprio
// na raiz). Sem CNAME, VITE_BASE continua valendo.
// Obs.: nunca abra dist/index.html direto via file:// — os módulos ES são
// bloqueados por CORS fora de HTTP; use `npm run preview` (ou um servidor).
export default defineConfig({
  plugins: [react()],
  base: hasCname ? './' : (process.env.VITE_BASE || '/marcador/'),
})
