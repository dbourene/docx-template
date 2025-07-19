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
    
    // Debug: vérifier ce qui est retourné
    console.log('✅ Résultat génération contrat:', result);
    console.log('📦 Résultat generateContrat:', Object.keys(result));
    console.log('📦 Taille du buffer:', result.buffer?.length);
    console.log('📦 Taille du docxBuffer:', result.docxBuffer?.length);
    
    const rawBuffer = result.buffer || result.docxBuffer; // récupère buffer depuis l'objet retourné
    const docxPath = path.join(__dirname, `temp/contrat-${contrat_id}.docx`);
    const pdfPath = path.join(__dirname, `temp/contrat-${contrat_id}.pdf`);

    // Vérifier que le buffer existe
    if (!rawBuffer) {
      throw new Error('Aucun buffer retourné par generateContrat');
    }

    // Transforme l'objet JSON-isé en vrai Buffer
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer.data);
    
    console.log('📦 Buffer final pour écriture:', buffer.length, 'bytes');
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
    // Retourner les informations du fichier généré (comme /convert)
    const pdfFileName = `CPV_${contrat_id}.pdf`;
    
    res.status(200).json({
      success: true,
      fileName: pdfFileName,
      message: 'Contrat généré et converti en PDF avec succès'
    });

    // 5. Nettoyage (optionnel mais recommandé)
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);

  } catch (error) {
    console.error('❌ Erreur génération contrat :', error);
    res.status(500).send('Erreur génération ou signature contrat');
  }
});

import { createClient } from '@supabase/supabase-js';

// Nouveau endpoint
app.post('/convert', async (req, res) => {
  const { contratId } = req.body;
  if (!contratId) {
    return res.status(400).json({ error: 'contratId manquant' });
  }

  console.log('🔄 Début conversion PDF pour contrat:', contratId);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // 👈 Important : autorisation RLS
  );

  // Créer le dossier temp si besoin
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const docxPath = path.join(__dirname, `temp/contrat-${contratId}.docx`);
  const pdfPath = path.join(__dirname, `temp/contrat-${contratId}.pdf`);

  try {
    // 1. Trouver le fichier .docx dans le bucket 'contrats'
    console.log('🔍 Recherche du fichier .docx dans le bucket contrats...');
    
    const { data: files, error: listError } = await supabase.storage
      .from('contrats')
      .list('consommateurs', {
        search: `contrat-${contratId}`
      });

    if (listError) {
      throw new Error(`Erreur recherche fichier: ${listError.message}`);
    }

    const docxFile = files?.find(file => file.name.includes(`contrat-${contratId}`) && file.name.endsWith('.docx'));
    
    if (!docxFile) {
      throw new Error(`Fichier .docx non trouvé pour le contrat ${contratId}`);
    }

    const docxStoragePath = `consommateurs/${docxFile.name}`;
    console.log('✅ Fichier .docx trouvé:', docxStoragePath);

    // 2. Télécharger le .docx depuis Supabase Storage
    console.log('⬇️ Téléchargement du .docx...');
    const { data: docxData, error: downloadError } = await supabase.storage
      .from('contrats')
      .download(docxStoragePath);

    if (downloadError) {
      throw new Error(`Erreur téléchargement .docx: ${downloadError.message}`);
    }

    // 3. Sauvegarder temporairement le .docx
    const arrayBuffer = await docxData.arrayBuffer();
    fs.writeFileSync(docxPath, Buffer.from(arrayBuffer));
    console.log('✅ Fichier .docx sauvegardé temporairement');

    // 4. Convertir .docx → .pdf avec LibreOffice
    console.log('🔄 Conversion .docx → .pdf...');
    await new Promise((resolve, reject) => {
      exec(`libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ Erreur LibreOffice:', stderr);
          return reject(err);
        }
        console.log('✅ Conversion LibreOffice terminée');
        resolve();
      });
    });

    // 5. Attendre que le PDF soit créé
    await waitForPdfFile(pdfPath);

    // 6. Lire le PDF généré
    console.log('📖 Lecture du PDF généré...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('✅ PDF lu, taille:', pdfBuffer.length, 'bytes');

    // 7. Uploader le PDF dans le bucket 'contrats', dossier 'consommateurs'
    const pdfFileName = docxFile.name.replace('.docx', '.pdf');
    const pdfUploadPath = `consommateurs/${pdfFileName}`;
    
    console.log('⬆️ Upload PDF vers:', pdfUploadPath);
    
    const { error: uploadError } = await supabase.storage
      .from('contrats')
      .upload(pdfUploadPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

    if (uploadError) {
      console.error('❌ Erreur upload PDF:', uploadError);
      throw new Error('Erreur upload PDF vers Supabase');
    }

    // 8. Générer l'URL publique
    const { data: urlData } = supabase.storage
      .from('contrats')
      .getPublicUrl(pdfUploadPath);

    console.log('✅ PDF uploadé avec succès:', urlData.publicUrl);

    res.status(200).json({
      success: true,
      fileName: pdfFileName,
      url: urlData.publicUrl
    });

    // 9. Nettoyage des fichiers temporaires
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);
    console.log('🧹 Fichiers temporaires supprimés');
    
  } catch (error) {
    console.error('❌ Erreur endpoint /convert:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
