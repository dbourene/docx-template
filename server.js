import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateContrat } from './scripts/generateContrat.js';

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to wait for PDF file to be created
async function waitForPdfFile(pdfPath, maxRetries = 10, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fsPromises.access(pdfPath, fs.constants.F_OK);
      console.log(`✅ PDF file found after ${i + 1} attempts`);
      return true;
    } catch (error) {
      console.log(`⏳ Waiting for PDF file... attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`PDF file not created after ${maxRetries} attempts: ${pdfPath}`);
}

app.post('/generate', async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  try {
    // Créer le dossier temp s'il n'existe pas
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 1. Générer le fichier .docx
    const result = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);
    const { buffer: rawBuffer } = result; // récupère buffer depuis l'objet retourné
    const docxPath = path.join(__dirname, `temp/contrat-${contrat_id}.docx`);
    const pdfPath = path.join(__dirname, `temp/contrat-${contrat_id}.pdf`);

    // Transforme l'objet JSON-isé en vrai Buffer
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer.data);
    fs.writeFileSync(docxPath, buffer);

    // 2. Convertir .docx → .pdf (utilise LibreOffice en ligne de commande)
    console.log('🔄 Starting LibreOffice conversion...');
    await new Promise((resolve, reject) => {
      exec(`libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('Erreur conversion LibreOffice:', stderr);
          reject(err);
        } else {
          console.log('✅ LibreOffice command completed');
          console.log('stdout:', stdout);
          resolve();
        }
      });
    });

    // 2.5. Wait for PDF file to be created
    await waitForPdfFile(pdfPath);

    // 3. Charger le PDF et ajouter une signature visuelle avec pdf-lib
    console.log('📖 Loading PDF file...');
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
