// routers/generate.js
// Définit le endpoint POST /generate

import express from 'express';
import { handleGenerateContrat } from '../services/contrat/handleGenerateContrat.js';

const router = express.Router();

// Le router est déjà monté à /generate dans server.js, donc ici on met juste "/"
router.post('/', handleGenerateContrat);

export default router;

