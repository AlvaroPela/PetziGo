import { defineConfig } from 'vite';

// Añade aquí hosts de ngrok u otros dominios de desarrollo que necesites permitir.
export default defineConfig({
  server: {
    // Permite conexiones desde la red (necesario para ngrok)
    host: true,
    // Lista blanca de hosts permitidos. Añade el dominio ngrok que te indicó el error.
    allowedHosts: ['localhost', '127.0.0.1', '523aecef5889.ngrok-free.app']
  }
});
