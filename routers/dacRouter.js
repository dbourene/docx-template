// routers/dacRouter.js

import express from "express";
import { handleAutorisationCommunication } from "../services/dac/autorisationCommunicationService.js";

const router = express.Router();

// POST /autorisation-communication
router.post("/autorisation-communication", async (req, res) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const { user_id, role, donnees_mesures, donnees_index, donnees_pmax, donnees_cdc, donnees_techniques, habilitation } = req.body;

    if (!user_id || !role) {
      return res.status(400).json({ error: "user_id et role sont obligatoires" });
    }

    const result = await handleAutorisationCommunication({
      user_id,
      role,
      donnees_mesures,
      donnees_index,
      donnees_pmax,
      donnees_cdc,
      donnees_techniques,
      habilitation,
      adresse_IP: ip,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur autorisation communication:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'autorisation" });
  }
});

export default router;
