import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Iniciar Sesión (Admin, Mercadotecnia y Socios)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña requeridos' });
    return;
  }

  try {
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(403).json({ error: 'Esta cuenta se encuentra desactivada' });
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
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('[Error Login]:', err);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// Registro de nuevos Socios desde la App Móvil
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName, phone, socioCpoId } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'Email, contraseña y nombre completo requeridos' });
    return;
  }

  try {
    // Verificar si ya existe
    const exists = await query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (exists.rows.length > 0) {
      res.status(409).json({ error: 'El correo electrónico ya está registrado' });
      return;
    }

    // Rol socio por defecto
    const roleRes = await query("SELECT id FROM roles WHERE name = 'socio'");
    const socioRoleId = roleRes.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertUser = await query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone, socio_cpo_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name`,
      [socioRoleId, email.trim().toLowerCase(), passwordHash, fullName, phone || null, socioCpoId || null]
    );

    const newUser = insertUser.rows[0];

    // Inicializar racha
    await query(
      'INSERT INTO user_streaks (user_id, current_streak_days, max_streak_days, total_coins) VALUES ($1, 1, 1, 100)',
      [newUser.id]
    );

    const secret = process.env.JWT_SECRET || 'PlayCoopSecretKey2026_Oblatos_CPO_Secure!';
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: 'socio',
        fullName: newUser.full_name
      },
      secret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registro exitoso',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: 'socio'
      }
    });
  } catch (err: any) {
    console.error('[Error Registro]:', err);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

// Perfil del usuario autenticado
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.socio_cpo_id, r.name as role,
              COALESCE(s.current_streak_days, 1) as streak_days,
              COALESCE(s.total_coins, 0) as coins
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_streaks s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar perfil' });
  }
});

export default router;
