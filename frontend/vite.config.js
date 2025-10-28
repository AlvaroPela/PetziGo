import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Añade aquí los hosts de ngrok / tunel que quieras permitir.
// Reemplaza o añade más entradas si ngrok te da otra url.
export default defineConfig({
  plugins: [react()],
  server: {
    // permitir conexiones desde redes externas (ngrok) — deja true para escuchar en 0.0.0.0
    host: true,
    port: 5173,
    // hosts permitidos para peticiones entrantes.
    // Permitir todos los subdominios de ngrok-free.app para no tener que actualizar la config
    // cada vez que ngrok genere un subdominio nuevo.
    // Puedes añadir otros dominios o volver a un host concreto si lo prefieres.
    allowedHosts: ['.ngrok-free.app']
  }
})
