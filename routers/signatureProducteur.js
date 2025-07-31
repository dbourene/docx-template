// Définit le endpoint POST /signature-producteur

// import handleSignatureProducteur from '../services/handleSignatureProducteur.js';
// router.post('/', handleSignatureProducteur);
import express from 'express';
import { handleSignatureProducteur } from '../services/contrat/handleSignatureProducteur.js';


const router = express.Router();

router.post('/', handleSignatureProducteur);

export default router;