import express from 'express';
import {sendDateDemarrageNotification} from '../services/operations/sendDateDemarrageNotification.js';

const router = express.Router();

/**
 * POST /operations/date-demarrage-notification
 * Body attendu : { operation_id }
 */
router.post('/date-demarrage-notification', async (req, res) => {
  const { operation_id } = req.body;

  if (!operation_id) {
    return res.status(400).json({ error: 'operation_id est requis' });
  }

  const result = await sendDateDemarrageNotification(operation_id);
  if (result.success) {
    res.status(200).json({ message: 'Notification envoyée avec succès' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

export default router;