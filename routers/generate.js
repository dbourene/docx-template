// Définit le endpoint POST /generate

import express from 'express';
import { handleGenerateContrat } from '../services/handleGenerateContrat.js';

const router = express.Router();

router.post('/generate', handleGenerateContrat);

export default router;

