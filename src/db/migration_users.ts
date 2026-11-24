import { query } from '../config/db';

export async function runMigration() {
  try {
    console.log('--- Iniciando migración de esquema users ---');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)');
    await query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');

    await query(`
      UPDATE users 
      SET 
        username = COALESCE(username, SPLIT_PART(email, '@', 1)),
        first_name = COALESCE(first_name, SPLIT_PART(full_name, ' ', 1)),
        last_name = COALESCE(last_name, SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1))
      WHERE username IS NULL
    `);

    const res = await query('SELECT id, username, first_name, last_name, email, is_active FROM users');
    console.log('Migración exitosa. Usuarios actuales:', res.rows);
  } catch (error) {
    console.error('Error en migración:', error);
    throw error;
  }
}
