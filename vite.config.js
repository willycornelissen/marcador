import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hasCname = fs.existsSync(path.resolve(__dirname, 'public/CNAME'))

// base: caminho do repositório no GitHub Pages. Ajuste se o nome do repo mudar.
export default defineConfig({
  plugins: [react()],
  base: hasCname ? '/' : (process.env.VITE_BASE || '/marcador/'),
})
