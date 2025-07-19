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
    console.log('🚀 Début endpoint /generate');
    console.log('📋 Paramètres reçus:', { contrat_id, consommateur_id, producteur_id, installation_id });

    // Créer le dossier temp s'il n'existe pas
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('📁 Dossier temp créé:', tempDir);
    }

    // 1. Générer le fichier .docx
    console.log('📄 Génération du fichier .docx...');
    const result = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);
    
    console.log('✅ Résultat génération contrat:', {
      success: result.success,
      fileName: result.fileName,
      hasBuffer: !!result.buffer,
      hasDocxBuffer: !!result.docxBuffer,
      bufferSize: result.buffer?.length || result.docxBuffer?.length
    });
    
    // Récupérer le buffer du fichier .docx
    const docxBuffer = result.buffer || result.docxBuffer;
    
    if (!docxBuffer) {
      throw new Error('Aucun buffer retourné par generateContrat');
    }

    console.log('📦 Buffer récupéré, taille:', docxBuffer.length, 'bytes');

    // Chemins des fichiers
    const docxPath = path.join(tempDir, `contrat-${contrat_id}.docx`);
    const pdfPath = path.join(tempDir, `contrat-${contrat_id}.pdf`);

    console.log('📁 Chemins fichiers:');
    console.log('  DOCX:', docxPath);
    console.log('  PDF:', pdfPath);

    // 2. Sauvegarder le fichier .docx
    console.log('💾 Écriture du fichier .docx...');
    fs.writeFileSync(docxPath, docxBuffer);
    
    // Vérifier que le fichier a bien été créé
    if (!fs.existsSync(docxPath)) {
      throw new Error('Fichier .docx non créé sur le disque');
    }
    
    const docxStats = fs.statSync(docxPath);
    console.log('✅ Fichier .docx créé avec succès:');
    console.log('  Chemin:', docxPath);
    console.log('  Taille:', docxStats.size, 'bytes');

    // 3. Convertir .docx → .pdf avec LibreOffice
    console.log('🔄 Conversion .docx → .pdf avec LibreOffice...');
    const conversionCommand = `libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${tempDir}"`;
    console.log('⚙️ Commande LibreOffice:', conversionCommand);
    
    await new Promise((resolve, reject) => {
      exec(conversionCommand, (err, stdout, stderr) => {
        console.log('📋 LibreOffice stdout:', stdout);
        if (stderr) {
          console.log('⚠️ LibreOffice stderr:', stderr);
        }
        
        if (err) {
          console.error('❌ Erreur conversion LibreOffice:', err);
          reject(new Error(`Erreur LibreOffice: ${stderr || err.message}`));
        } else {
          console.log('✅ Commande LibreOffice terminée');
          resolve(stdout);
        }
      });
    });

    // 4. Attendre que le PDF soit créé
    console.log('⏳ Attente de la création du fichier PDF...');
    await waitForPdfFile(pdfPath);
    
    // Vérifier la taille du PDF créé
    const pdfStats = fs.statSync(pdfPath);
    console.log('✅ PDF créé avec succès:');
    console.log('  Chemin:', pdfPath);
    console.log('  Taille:', pdfStats.size, 'bytes');

    // 5. Charger le PDF et ajouter une signature visuelle
    console.log('📖 Chargement du PDF pour signature...');
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Ajouter une signature textuelle
    firstPage.drawText(`Signé électroniquement - Contrat ${contrat_id}`, {
      x: 50,
      y: 50,
      size: 10,
      color: rgb(0, 0, 0),
    });

    const modifiedPdfBytes = await pdfDoc.save();
    console.log('✅ Signature ajoutée au PDF');

    // 6. Sauvegarder le PDF modifié
    fs.writeFileSync(pdfPath, modifiedPdfBytes);
    console.log('💾 PDF signé sauvegardé');

    // 7. Répondre au client
    const pdfFileName = `CPV_${contrat_id}.pdf`;
    
    console.log('🎉 Contrat généré avec succès:');
    console.log('  Fichier DOCX:', fs.existsSync(docxPath) ? 'Créé' : 'MANQUANT');
    console.log('  Fichier PDF:', fs.existsSync(pdfPath) ? 'Créé' : 'MANQUANT');
    
    res.status(200).json({
      success: true,
      fileName: pdfFileName,
      message: 'Contrat généré et converti en PDF avec succès'
    });

    // 8. Nettoyage des fichiers temporaires (après un délai)
    setTimeout(() => {
      try {
        if (fs.existsSync(docxPath)) {
          fs.unlinkSync(docxPath);
          console.log('🧹 Fichier .docx temporaire supprimé');
        }
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log('🧹 Fichier .pdf temporaire supprimé');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Erreur lors du nettoyage:', cleanupError.message);
      }
    }, 5000); // Délai de 5 secondes

  } catch (error) {
    console.error('❌ Erreur génération contrat:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

import { createClient } from '@supabase/supabase-js';

// Endpoint pour convertir un .docx existant en PDF
app.post('/convert', async (req, res) => {
  const { contratId } = req.body;
  if (!contratId) {
    return res.status(400).json({ error: 'contratId manquant' });
  }

  console.log('🔄 Début conversion PDF pour contrat:', contratId);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Créer le dossier temp si besoin
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const docxPath = path.join(tempDir, `contrat-${contratId}.docx`);
  const pdfPath = path.join(tempDir, `contrat-${contratId}.pdf`);

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
      exec(`libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${tempDir}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ Erreur LibreOffice:', stderr);
          return reject(err);
        }
        console.log('✅ Conversion LibreOffice terminée');
        resolve(stdout);
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
    setTimeout(() => {
      try {
        if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        console.log('🧹 Fichiers temporaires supprimés');
      } catch (cleanupError) {
        console.warn('⚠️ Erreur nettoyage:', cleanupError.message);
      }
    }, 2000);
    
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