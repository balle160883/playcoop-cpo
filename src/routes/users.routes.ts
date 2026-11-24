import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

// Todas las rutas de gestión de usuarios requieren autenticación y rol de 'admin' o 'administrador'
router.use(authenticateJWT, requireRoles(['admin', 'administrador']));

// 1. Listar todos los usuarios con su rol
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.full_name, u.email, u.phone, 
              u.socio_cpo_id, u.is_active, u.created_at, r.name as role, r.id as role_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[Error List Users]:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// 2. Crear un nuevo usuario
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { username, firstName, lastName, password, roleId, email, phone, socioCpoId } = req.body;

  if (!username || !firstName || !lastName || !password) {
    res.status(400).json({ error: 'Usuario, Nombre, Apellido y Contraseña son obligatorios' });
    return;
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'El nombre de usuario ya está registrado' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const targetRoleId = roleId || 3; // socio por defecto si no se pasa

    const result = await query(
      `INSERT INTO users (role_id, username, first_name, last_name, full_name, email, password_hash, phone, socio_cpo_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id, username, first_name, last_name, full_name, email, is_active, created_at`,
      [
        targetRoleId,
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

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: result.rows[0]
    });
  } catch (err: any) {
    console.error('[Error Create User]:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// 3. Editar datos de un usuario (Nombre, Apellido, Rol, Email, Teléfono)
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { username, firstName, lastName, roleId, email, phone, socioCpoId } = req.body;

  try {
    const targetUser = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Si modifica username, checar unicidad
    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      const duplicate = await query('SELECT id FROM users WHERE username = $1 AND id <> $2', [cleanUsername, id]);
      if (duplicate.rows.length > 0) {
        res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
        return;
      }
    }

    const fullName = firstName && lastName ? `${firstName.trim()} ${lastName.trim()}` : undefined;

    const result = await query(
      `UPDATE users
       SET 
         username = COALESCE($1, username),
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         full_name = COALESCE($4, full_name),
         role_id = COALESCE($5, role_id),
         email = COALESCE($6, email),
         phone = COALESCE($7, phone),
         socio_cpo_id = COALESCE($8, socio_cpo_id),
         updated_at = NOW()
       WHERE id = $9
       RETURNING id, username, first_name, last_name, full_name, email, role_id, is_active`,
      [
        username ? username.trim().toLowerCase() : null,
        firstName ? firstName.trim() : null,
        lastName ? lastName.trim() : null,
        fullName || null,
        roleId || null,
        email ? email.trim().toLowerCase() : null,
        phone || null,
        socioCpoId || null,
        id
      ]
    );

    res.json({
      message: 'Usuario actualizado correctamente',
      user: result.rows[0]
    });
  } catch (err: any) {
    console.error('[Error Update User]:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// 4. Bloquear / Desbloquear (suspender o activar)
router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'El parámetro isActive booleano es requerido' });
    return;
  }

  // Prevenir que el admin principal se auto-bloquee
  const currentAdmin = (req as any).user;
  if (parseInt(id, 10) === currentAdmin.id && !isActive) {
    res.status(400).json({ error: 'No puedes bloquear tu propia cuenta de administrador' });
    return;
  }

  try {
    const result = await query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name, is_active`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({
      message: isActive ? 'Usuario reactivado con éxito' : 'Usuario bloqueado/suspendido con éxito',
      user: result.rows[0]
    });
  } catch (err: any) {
    console.error('[Error Toggle User Status]:', err);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
});

// 5. Restablecer / Cambiar contraseña de un usuario
router.patch('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const result = await query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({
      message: `Contraseña de ${result.rows[0].username} restablecida con éxito`
    });
  } catch (err: any) {
    console.error('[Error Reset Password]:', err);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// 6. Eliminar usuario
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const currentAdmin = (req as any).user;

  if (parseInt(id, 10) === currentAdmin.id) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' });
    return;
  }

  try {
    // Eliminar referencias asociadas primero si existen
    await query('DELETE FROM game_scores WHERE user_id = $1', [id]);
    await query('DELETE FROM user_streaks WHERE user_id = $1', [id]);

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({
      message: `Usuario ${result.rows[0].username} eliminado permanentemente`
    });
  } catch (err: any) {
    console.error('[Error Delete User]:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

export default router;
