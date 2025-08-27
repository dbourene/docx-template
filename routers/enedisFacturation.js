// routers/enedisFacturation.js
import express from "express";
import { runEnedisJob } from "../services/enedis/index.js";
import { handleGenerateFacture } from "../services/facturation/handleGenerateFacture.js";

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

    // 👉 Étape 1 : Récupération des données ENEDIS
    const enedisResult = await runEnedisJob(operationId, start, end);
    console.log("✅ Résultat du job ENEDIS:", enedisResult);

    if (!enedisResult || !enedisResult.success) {
      return res.status(500).json({
        success: false,
        error: enedisResult?.error || "Erreur lors de l'exécution du job ENEDIS"
      });
    }

    // 👉 Étape 2 : Génération des factures après insertion des données
    let factureResult;
    try {
      factureResult = await generateFacturesForOperation(operationId, start, end);
      console.log("✅ Résultat facturation:", factureResult);
    } catch (factureError) {
      console.error("❌ Erreur génération factures:", factureError);
      return res.status(500).json({
        success: false,
        error: "Données ENEDIS OK mais erreur lors de la génération des factures",
        details: factureError.message
      });
    }

    // 👉 Étape 3 : Réponse complète
    return res.json({
      success: true,
      message: "Récupération ENEDIS et génération des factures réussies ✅",
      enedis: enedisResult.details || null,
      factures: factureResult.details || null
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
