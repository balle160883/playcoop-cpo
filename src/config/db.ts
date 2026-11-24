import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || '31.97.144.6',
  port: parseInt(process.env.DB_PORT || '5441', 10),
  database: process.env.DB_NAME || 'playcoop-cpo',
  user: process.env.DB_USER || 'cpo-dev1',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Error inesperado en el pool]:', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
