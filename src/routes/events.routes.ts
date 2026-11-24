import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

// Obtener eventos activos
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT * FROM coop_events WHERE is_active = TRUE ORDER BY event_date ASC, created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar eventos' });
  }
});

// Crear evento (Solo Mercadotecnia y Admin)
router.post(
  '/',
  authenticateJWT,
  requireRoles(['admin', 'marketing']),
  async (req: Request, res: Response): Promise<void> => {
    const { title, description, bannerUrl, eventDate } = req.body;

    if (!title) {
      res.status(400).json({ error: 'El título del evento es obligatorio' });
      return;
    }

    try {
      const result = await query(
        `INSERT INTO coop_events (title, description, banner_url, event_date, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [title, description || null, bannerUrl || null, eventDate || null, req.user!.id]
      );

      res.status(201).json({
        message: 'Evento publicado exitosamente',
        event: result.rows[0]
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear evento' });
    }
  }
);

export default router;
