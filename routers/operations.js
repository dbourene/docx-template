import express from 'express';
import {sendDateDemarrageNotification} from '../services/operations/sendDateDemarrageNotification.js';

const router = express.Router();

/**
 * POST /operations/date-demarrage-notification
 * Body attendu : { operation_id, numero_acc, start_date }
 */
router.post('/date-demarrage-notification', async (req, res) => {
  const { operation_id, numero_acc, start_date } = req.body;

  if (!operation_id || !numero_acc || !start_date) {
    return res.status(400).json({ error: 'operation_id, numero_acc et start_date sont requis' });
  }

  const result = await sendDateDemarrageNotification(operation_id, numero_acc, start_date);
  if (result.success) {
    res.status(200).json({ message: 'Notification envoyée avec succès' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

export default router;