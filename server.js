import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import generateRouter from './routers/generate.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join('/app', 'temp');
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use('/generate', generateRouter);

// Route de base pour vérifier que le serveur est en ligne - à utiliser pour les tests 
app.get('/', (req, res) => {
  res.send('✅ Serveur en ligne');
});




// Crée le dossier /temp si besoin
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
  console.log('📁 Dossier temp créé');
}

// Gestion globale des erreurs
process.on('uncaughtException', (err) => {
  console.error('❌ ERREUR NON GÉRÉE:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ PROMESSE REJETÉE NON GÉRÉE:', reason);
  process.exit(1);
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
