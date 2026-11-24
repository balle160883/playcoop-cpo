import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import mediaRoutes from './routes/media.routes';
import triviaRoutes from './routes/trivia.routes';
import gameRoutes from './routes/game.routes';
import eventRoutes from './routes/events.routes';
import userRoutes from './routes/users.routes';
import { query } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Panel CMS y archivos subidos
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API REST limpia
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/trivias', triviaRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);

// Health check para Dokploy / Docker
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'playcoop-backend-dokploy',
      database: 'connected-postgresql',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// Redireccionar cualquier otra ruta al Panel Web CMS
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PlayCoop Backend & Panel CMS corriendo en puerto ${PORT}`);
  console.log(`🌐 Base de datos: PostgreSQL (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);
  console.log(`💻 Panel Web CMS: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
