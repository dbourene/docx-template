import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateContrat } from './scripts/generateContrat.js';

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.post('/generate', async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  try {
    // 1. Générer le fichier .docx
    const fileBuffer = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);
    const docxPath = path.join(__dirname, `temp/contrat-${contrat_id}.docx`);
    const pdfPath = path.join(__dirname, `temp/contrat-${contrat_id}.pdf`);

    fs.writeFileSync(docxPath, fileBuffer);

    // 2. Convertir .docx → .pdf (utilise LibreOffice en ligne de commande)
    await new Promise((resolve, reject) => {
      exec(`libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('Erreur conversion LibreOffice:', stderr);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // 3. Charger le PDF et ajouter une signature visuelle avec pdf-lib
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Exemple de signature textuelle en bas de page
    firstPage.drawText(`Signé électroniquement par le consommateur`, {
      x: 50,
      y: 50,
      size: 10,
      color: rgb(0, 0, 0),
    });

    const modifiedPdfBytes = await pdfDoc.save();

    // 4. Répondre au client avec le PDF signé
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrat-${contrat_id}.pdf`);
    res.send(modifiedPdfBytes);

    // 5. Nettoyage (optionnel mais recommandé)
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);

  } catch (error) {
    console.error('❌ Erreur génération contrat :', error);
    res.status(500).send('Erreur génération ou signature contrat');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
