// routers/autorisationsRouter.js

import express from "express";
import { handleAutorisationCommunication } from "../services/autorisations/autorisationCommunicationDonnees.js";
import { handleAutorisationParticipation } from "../services/autorisations/autorisationParticipationAcc.js";
import { handleAcceptationCGU } from "../services/autorisations/acceptationCgu.js"; 

const router = express.Router();

// Utilitaire pour extraire l'adresse IP du client
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    null
  );
}

// POST /autorisation-communication
// Enregistrement de l'autorisation de communication des données
router.post("/autorisation-communication", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const { 
      user_id,
      role,
      donnees_mesures,
      donnees_index,
      donnees_pmax,
      donnees_cdc,
      donnees_techniques,
      habilitation,
      validation_cgu
    } = req.body;

    if (!user_id || !role || validation_cgu === undefined) {
      return res.status(400).json({ error: "user_id, role et validation_cgu sont obligatoires" });
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
      validation_cgu
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur autorisation communication:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'autorisation" });
  }
});

// POST /autorisation-participation-acc
// Enregistrement de l'autorisation de participation à l'ACC
router.post("/autorisation-participation-acc", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const {
      user_id,
      role,
      collecte_cdc,
      transmission_fournisseur,
      transmission_tiers_cons,
      transmission_tiers_prod,
      accord_participation
    } = req.body;

    if (!user_id || !role || accord_participation === undefined) {
      return res.status(400).json({ error: "user_id, role et accord_participation sont obligatoires" });
    }

    const result = await handleAutorisationParticipation({
      user_id,
      role,
      collecte_cdc,
      transmission_fournisseur,
      transmission_tiers_cons,
      transmission_tiers_prod,
      accord_participation,
      adresse_IP: ip
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur autorisation participation à l'ACC:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'autorisation de participation à l'ACC" });
  }
});

// POST /acceptation-cgu
// Enregistrement de l'acceptation des CGU
router.post("/acceptation-cgu", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const { 
      user_id,
      role,
      validation_cgu
    } = req.body;

    if (!user_id || !role || !validation_cgu) {
      return res.status(400).json({ error: "user_id, role et validation_cgu sont obligatoires" });
    }

    const result = await handleAcceptationCGU({
      user_id,
      role,
      validation_cgu,
      adresse_IP: ip
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur acceptation CGU:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'acceptation des CGU" });
  }
});

export default router;
