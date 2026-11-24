import { Router, Request, Response } from 'express';
import { query } from '../config/db';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Guardar puntuación del juego de la alcancía
router.post('/score', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const { score, levelReached } = req.body;

  if (score === undefined || score < 0) {
    res.status(400).json({ error: 'Puntuación inválida' });
    return;
  }

  // Validación de seguridad de puntajes (máximo 10,000 pts por sesión)
  if (score > 10000) {
    res.status(400).json({ error: 'Puntuación fuera de rango permitido' });
    return;
  }

  const coinsEarned = Math.floor(score / 10);

  try {
    // Insertar partida
    await query(
      'INSERT INTO game_scores (user_id, score, level_reached, coins_earned) VALUES ($1, $2, $3, $4)',
      [req.user!.id, score, levelReached || 1, coinsEarned]
    );

    // Sumar monedas al balance del usuario
    await query(
      `INSERT INTO user_streaks (user_id, total_coins) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET total_coins = user_streaks.total_coins + $2`,
      [req.user!.id, coinsEarned]
    );

    res.json({
      message: 'Puntuación registrada exitosamente',
      score,
      coinsEarned
    });
  } catch (err) {
    console.error('[Error Game Score]:', err);
    res.status(500).json({ error: 'Error al registrar puntuación' });
  }
});

// Obtener tabla de clasificación (Leaderboard global)
router.get('/ranking', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);

  try {
    const result = await query(
      `SELECT u.id, u.full_name, MAX(g.score) as highest_score, MAX(g.level_reached) as max_level
       FROM game_scores g
       JOIN users u ON g.user_id = u.id
       GROUP BY u.id, u.full_name
       ORDER BY highest_score DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tabla de clasificación' });
  }
});

export default router;
