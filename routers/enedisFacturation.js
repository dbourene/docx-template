// routers/enedisFacturation.js
import express from "express";
import { runEnedisJob } from "../services/enedis/index.js";

const router = express.Router();

/**
 * POST /enedis/fetch
 * Lance la récupération des données ENEDIS pour une opération donnée et une période
 * 
 * body attendu : {
 *   operationId: "uuid",
 *   start: "20250101T000000Z",
 *   end: "20250131T235959Z"
 * }
 */
router.post("/fetch", async (req, res) => {
  try {
    const { operationId, start, end } = req.body;
    console.log("🚀 ~ file: enedisFacturation.js:20 ~ router.post ~ req.body:", req.body);
    
    if (!operationId || !start || !end) {
      return res.status(400).json({ error: "operationId, start et end sont requis" });
    }

    const result = await runEnedisJob(operationId, start, end);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ message: "Données ENEDIS récupérées avec succès ✅" });
  } catch (err) {
    console.error("❌ Erreur API /enedis/fetch :", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
