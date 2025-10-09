// routers/repartitions.js
import express from "express";
import { processMails } from "../services/repartition/processMails.js";

const router = express.Router();

/**
 * Route temporaire de test avant intégration frontend.
 * Exemple d’appel manuel : POST /repartitions/processMails avec body { "month": "09_2025" }
 */
router.post("/processMails", async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ error: "Paramètre 'month' requis (ex: '09_2025')" });
    }

    console.log(`🟢 Déclenchement du traitement Enedis pour le mois ${month}`);
    const result = await processMails(month);

    res.json({
      status: "ok",
      message: `Traitement terminé pour ${month}`,
      details: result,
    });
  } catch (err) {
    console.error("❌ Erreur dans /repartitions/processMails:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
