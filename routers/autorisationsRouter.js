// routers/autorisationsRouter.js

import express from "express";
import { handleAutorisationCommunication } from "../services/autorisations/autorisationCommunicationDonnees.js";
import { handleAccordParticipation } from "../services/autorisations/accordParticipationAcc.js";
import { handleAcceptationCGU } from "../services/autorisations/acceptationCgu.js"; 
import { handleRenoncementDroitRetractation } from "../services/autorisations/renoncementDroitRetractation.js";
import { getClientIp } from "../services/common/getClientIp.js";

const router = express.Router();

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
      ip,
      role,
      donnees_mesures,
      donnees_index,
      donnees_pmax,
      donnees_cdc,
      donnees_techniques,
      habilitation,
      validation_cgu
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur autorisation communication:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'autorisation" });
  }
});

// POST /accord-participation-acc
// Enregistrement de l'accord de participation à l'ACC
router.post("/accord-participation-acc", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const {
      user_id,
      role,
      collecte_cdc,
      transmission_fournisseur,
      transmission_tiers_cons,
      transmission_tiers_prod,
      accord_participation,
      prm
    } = req.body;

    if (!user_id || !role || accord_participation === undefined || !prm) {
      return res.status(400).json({ error: "user_id, role, accord_participation et prm sont obligatoires" });
    }

    const result = await handleAccordParticipation({
      user_id,
      ip,
      role,
      collecte_cdc,
      transmission_fournisseur,
      transmission_tiers_cons,
      transmission_tiers_prod,
      accord_participation,
      prm
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur accord participation à l'ACC:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'accord de participation à l'ACC" });
  }
});

// POST /renoncement-droit-retractation
// Enregistrement du renoncement au droit de rétractation
router.post("/renoncement-droit-retractation", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const { 
      user_id,
      role,
      renoncement_retractation,
      prm
    } = req.body;

    if (!user_id || !role || !renoncement_retractation || !prm) {
      return res.status(400).json({ error: "user_id, role, renoncement_retractation et prm sont obligatoires" });
    }

    const result = await handleRenoncementDroitRetractation({
      user_id,
      ip,
      role,
      renoncement_retractation,
      prm
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur renoncement droit de rétractation:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du renoncement au droit de rétractation" });
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
      ip,
      role,
      validation_cgu
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Erreur acceptation CGU:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'acceptation des CGU" });
  }
});

export default router;
