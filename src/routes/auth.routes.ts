import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Iniciar Sesión (Admin, Mercadotecnia y Socios por Usuario o por Correo)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { identifier, email, username, password } = req.body;
  const loginId = identifier || username || email;

  if (!loginId || !password) {
    res.status(400).json({ error: 'Usuario (o correo) y contraseña son requeridos' });
    return;
  }

  try {
    const cleanId = loginId.trim().toLowerCase();
    const result = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.password_hash, u.full_name, u.is_active, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = $1 OR LOWER(COALESCE(u.email, '')) = $1`,
      [cleanId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(403).json({ error: 'Esta cuenta se encuentra bloqueada o suspendida. Contacta a un administrador.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'PlayCoopSecretKey2026_Oblatos_CPO_Secure!';
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('[Error Login]:', err);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// Registro de nuevos Socios desde la App Móvil (con Nombre, Apellido y Usuario)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, firstName, lastName, password, email, phone, socioCpoId } = req.body;

  if (!username || !firstName || !lastName || !password) {
    res.status(400).json({ error: 'Nombre de usuario, Nombre, Apellido y Contraseña son obligatorios' });
    return;
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const exists = await query('SELECT id FROM users WHERE LOWER(username) = $1', [cleanUsername]);
    if (exists.rows.length > 0) {
      res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
      return;
    }

    const roleRes = await query("SELECT id FROM roles WHERE name = 'socio'");
    const socioRoleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : 3;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const insertUser = await query(
      `INSERT INTO users (role_id, username, first_name, last_name, full_name, email, password_hash, phone, socio_cpo_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id, username, first_name, last_name, full_name, email`,
      [
        socioRoleId,
        cleanUsername,
        firstName.trim(),
        lastName.trim(),
        fullName,
        email ? email.trim().toLowerCase() : null,
        passwordHash,
        phone || null,
        socioCpoId || null
      ]
    );

    const newUser = insertUser.rows[0];
    const secret = process.env.JWT_SECRET || 'PlayCoopSecretKey2026_Oblatos_CPO_Secure!';
    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: 'socio',
        fullName: newUser.full_name
      },
      secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Socio registrado exitosamente',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        fullName: newUser.full_name,
        role: 'socio'
      }
    });
  } catch (err: any) {
    console.error('[Error Register]:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Perfil del usuario autenticado
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as any).user;

  try {
    const result = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.full_name, u.email, u.phone, 
              u.socio_cpo_id, u.is_active, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [authUser.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Error Profile]:', err);
    res.status(500).json({ error: 'Error al consultar perfil' });
  }
});

router.get('/profile', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as any).user;

  try {
    const result = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.full_name, u.email, u.phone, 
              u.socio_cpo_id, u.is_active, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [authUser.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[Error Profile]:', err);
    res.status(500).json({ error: 'Error al consultar perfil' });
  }
});

export default router;
