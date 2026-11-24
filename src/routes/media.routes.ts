import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authenticateJWT, requireRoles } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

// Obtener contenido multimedia activo (para la App Móvil y el CMS)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { category } = req.query;

  try {
    let sql = 'SELECT * FROM media_contents WHERE is_active = TRUE';
    const params: any[] = [];

    if (category) {
      sql += ' AND category = $1';
      params.push(category);
    }

    sql += ' ORDER BY display_order ASC, created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Error Media GET]:', err);
    res.status(500).json({ error: 'Error al obtener contenido multimedia' });
  }
});

// Subir video o imagen (Solo Mercadotecnia y Admin)
router.post(
  '/upload',
  authenticateJWT,
  requireRoles(['admin', 'marketing']),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No se subió ningún archivo' });
      return;
    }

    const { category, title, description, displayOrder } = req.body;

    if (!category || !title) {
      res.status(400).json({ error: 'La categoría y el título son obligatorios' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;
    const order = parseInt(displayOrder || '0', 10);

    try {
      const result = await query(
        `INSERT INTO media_contents (category, title, description, file_url, file_type, file_size, display_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [category, title, description || null, fileUrl, fileType, fileSize, order, req.user!.id]
      );

      res.status(201).json({
        message: 'Archivo cargado con éxito para la aplicación móvil',
        media: result.rows[0]
      });
    } catch (err) {
      console.error('[Error Media Upload]:', err);
      res.status(500).json({ error: 'Error al guardar metadatos del archivo' });
    }
  }
);

// Desactivar / Eliminar contenido multimedia (Admin o Mercadotecnia)
router.delete(
  '/:id',
  authenticateJWT,
  requireRoles(['admin', 'marketing']),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const result = await query(
        'UPDATE media_contents SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Contenido multimedia no encontrado' });
        return;
      }

      res.json({ message: 'Contenido desactivado de la aplicación móvil exitosamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar contenido' });
    }
  }
);

export default router;
