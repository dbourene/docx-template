// routers/enedisFacturation.js
import express from "express";
import { runEnedisJob } from "../services/enedis/index.js";

const router = express.Router();

router.post("/fetch", async (req, res) => {
  console.log("🚀 ~ POST /enedis/fetch ~ req.body:", req.body);

  try {
    const { operationId, start, end } = req.body;
    console.log(`📌 Paramètres reçus: operationId=${operationId}, start=${start}, end=${end}`);

    if (!operationId || !start || !end) {
      return res.status(400).json({
        success: false,
        error: "operationId, start et end sont requis"
      });
    }

    // 👉 Ici on lance vraiment le job ENEDIS
    const result = await runEnedisJob(operationId, start, end);
    console.log("✅ Résultat du job ENEDIS:", result);

    if (!result || !result.success) {
      return res.status(500).json({
        success: false,
        error: result?.error || "Erreur lors de l'exécution du job ENEDIS"
      });
    }

    return res.json({
      success: true,
      message: "Données ENEDIS récupérées avec succès ✅",
      details: result.details || null
    });

  } catch (err) {
    console.error("❌ Erreur API /enedis/fetch :", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Erreur interne serveur"
    });
  }
});

export default router;
