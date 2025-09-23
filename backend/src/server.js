import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/reviews', reviewsRoutes);

app.get('/', (_req, res) => {
  res.send('PetziGo API activa. Usa /api/health o las rutas /api/*');
});

app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
