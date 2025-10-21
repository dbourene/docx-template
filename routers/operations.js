// routers/operations.js
// Définit les endpoints liés aux opérations

import express from 'express';
import {sendDateDemarrageNotification} from '../services/operations/sendDateDemarrageNotification.js';
import { operationPrm } from '../services/operations/operationPrm.js'; 

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

  try {
    // Étape 1️⃣ : Appel de la fonction pour envoyer la notification
    const result = await sendDateDemarrageNotification(operation_id);
    if (result.success) {
      res.status(200).json({ message: 'Notification envoyée avec succès' });
    } else {
      res.status(500).json({ error: result.error });
    }

    // Étape 2️⃣ : Appel de la fonction operationPrm
    const prmResult = await operationPrm(operation_id);
    if (!prmResult.success) {
      console.error('⚠️ Erreur lors de l’insertion des PRM :', prmResult.error);
      return res.status(500).json({ error: prmResult.error });
    }
      console.log('✅ PRM insérés avec succès pour l’opération', operation_id);
  
      // Réponse finale au front
      res.status(200).json({ 
        message: 'Notification et insertion des PRM effectuées avec succès',
        inserted_count: prmResult.insertedCount 
      });

  } catch (error) {
    console.error('❌ Erreur endpoint /date-demarrage-notification :', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;