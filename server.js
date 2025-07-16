import express from 'express';
import cors from 'cors';
import { generateContrat } from './scripts/generateContrat.js'; // ton générateur

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { contratId, consommateurId, producteurId, installationId } = req.body;

  try {
    const fileBuffer = await generateContrat(contratId, consommateurId, producteurId, installationId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=contrat-${contratId}.docx`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Erreur génération contrat :', error);
    res.status(500).send('Erreur génération contrat');
  }
});

// ✅ Ceci est la ligne clé pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
