// routers/repartitions.js
import express from "express";
import { handleMails } from "../services/repartition/handleMails.js";

const router = express.Router();

/**
 * Route temporaire de test avant intégration frontend.
 * Exemple d’appel manuel : POST /repartition/handleMails avec body { "month": "09_2025" }
 */
router.post("/handleMails", async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: "Paramètre 'month' requis (ex: '09_2025')" });
    }

    console.log(`🟢 Déclenchement du traitement Enedis pour le mois ${month}`);
    const result = await handleMails(month);

    res.json({
      status: "ok",
      message: `Traitement terminé pour ${month}`,
      details: result,
    });
  } catch (err) {
    console.error("❌ Erreur dans /repartition/processMails:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
