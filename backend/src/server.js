// backend/src/server.js (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Si más adelante sirves archivos estáticos necesitarás path/url:
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.options('*', cors());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// 👉 Importa routers (asegúrate de que existan ./routes/auth.js y ./routes/users.js)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Home informativo (opcional)
app.get('/', (_req, res) => {
  res.send('PetziGo API ✅ — usa /api/health o /api/auth/* /api/users/*');
});

// 404 JSON
app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
