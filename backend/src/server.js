import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRequired } from './middleware/auth.js';

const app = express();

// Request logging (morgan provides concise logs)
app.use(morgan('dev'));

// Detailed request logger for debugging critical flows
app.use((req, res, next) => {
  console.log(`--> ${req.method} ${req.originalUrl} - query:`, req.query, 'body:', req.body ? req.body : '{}');
  next();
});

app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);
app.options('*', cors());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import servicesRoutes from './routes/services.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import documentsRoutes from './routes/documents.js';
import reviewsRoutes from './routes/reviews.js';
import paymentsRoutes from './routes/payments.js';
import providersRoutes from './routes/providers.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/providers', providersRoutes);

// Servir archivos estáticos subidos (imágenes, documentos)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => {
  res.send('PetziGo API activa. Usa /api/health o las rutas /api/*');
});

// Error handling middleware (logs error stack)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

