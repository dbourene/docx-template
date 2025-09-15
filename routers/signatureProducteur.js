// routers/signatureProducteur.js
// Définit le endpoint POST /signature-producteur

// import handleSignatureProducteur from '../services/handleSignatureProducteur.js';
// router.post('/', handleSignatureProducteur);
import express from 'express';
import { handleSignatureProducteur } from '../services/contrat/handleSignatureProducteur.js';


const router = express.Router();

router.post('/', (req, res, next) => {
  console.log('📬 Reçu POST /signature-producteur avec body :', req.body);
  next(); // Passe à handleSignatureProducteur
}, handleSignatureProducteur);

export default router;