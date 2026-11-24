import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

// Obtener trivias activas (App Móvil / CMS)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { difficulty } = req.query;

  try {
    let sql = 'SELECT id, question, option_a, option_b, option_c, option_d, difficulty, points_reward, explanation FROM trivias WHERE is_active = TRUE';
    const params: any[] = [];

    if (difficulty) {
      sql += ' AND difficulty = $1';
      params.push(difficulty);
    }

    sql += ' ORDER BY id ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
});

// Verificar respuesta de trivia y actualizar racha del socio
router.post('/verify', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const { triviaId, selectedOption } = req.body;

  if (!triviaId || !selectedOption) {
    res.status(400).json({ error: 'triviaId y selectedOption son requeridos' });
    return;
  }

  try {
    const result = await query('SELECT correct_option, explanation, points_reward FROM trivias WHERE id = $1', [triviaId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pregunta no encontrada' });
      return;
    }

    const trivia = result.rows[0];
    const isCorrect = trivia.correct_option.toUpperCase() === selectedOption.toString().trim().toUpperCase();

    if (isCorrect) {
      // Incrementar racha y monedas del usuario
      await query(
        `INSERT INTO user_streaks (user_id, current_streak_days, max_streak_days, last_challenge_date, total_coins)
         VALUES ($1, 1, 1, CURRENT_DATE, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           current_streak_days = user_streaks.current_streak_days + 1,
           max_streak_days = GREATEST(user_streaks.max_streak_days, user_streaks.current_streak_days + 1),
           last_challenge_date = CURRENT_DATE,
           total_coins = user_streaks.total_coins + $2,
           updated_at = CURRENT_TIMESTAMP`,
        [req.user!.id, trivia.points_reward]
      );
    }

    res.json({
      correct: isCorrect,
      correctOption: isCorrect ? trivia.correct_option : undefined,
      explanation: trivia.explanation,
      pointsAwarded: isCorrect ? trivia.points_reward : 0
    });
  } catch (err) {
    console.error('[Error Verify Trivia]:', err);
    res.status(500).json({ error: 'Error al verificar respuesta' });
  }
});

// Crear nueva pregunta (Solo Mercadotecnia y Admin)
router.post(
  '/',
  authenticateJWT,
  requireRoles(['admin', 'marketing']),
  async (req: Request, res: Response): Promise<void> => {
    const { question, optionA, optionB, optionC, optionD, correctOption, explanation, difficulty, pointsReward } = req.body;

    if (!question || !optionA || !optionB || !correctOption) {
      res.status(400).json({ error: 'Pregunta, opciones A y B, y opción correcta son requeridas' });
      return;
    }

    try {
      const result = await query(
        `INSERT INTO trivias (question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, points_reward, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          question,
          optionA,
          optionB,
          optionC || '',
          optionD || null,
          correctOption.toUpperCase(),
          explanation || null,
          difficulty || 'normal',
          pointsReward || 20,
          req.user!.id
        ]
      );

      res.status(201).json({
        message: 'Pregunta de RachaCoop creada exitosamente',
        trivia: result.rows[0]
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear pregunta' });
    }
  }
);

// Eliminar / Desactivar pregunta
router.delete(
  '/:id',
  authenticateJWT,
  requireRoles(['admin', 'marketing']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await query('UPDATE trivias SET is_active = FALSE WHERE id = $1', [req.params.id]);
      res.json({ message: 'Pregunta desactivada exitosamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar pregunta' });
    }
  }
);

export default router;
