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
  console.log(`⏳ Attente fichier PDF: ${pdfPath}`);
  console.log(`🔄 Configuration: ${maxRetries} tentatives, délai ${delayMs}ms`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fsPromises.access(pdfPath, fs.constants.F_OK);
      const stats = await fsPromises.stat(pdfPath);
      console.log(`✅ PDF trouvé après ${i + 1} tentative(s), taille: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        console.warn(`⚠️ PDF trouvé mais vide, tentative ${i + 1}/${maxRetries}`);
        throw new Error('PDF vide');
      }
      
      return true;
    } catch (error) {
      console.log(`⏳ Attente PDF... tentative ${i + 1}/${maxRetries} (${error.message})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Diagnostic final si échec
  console.error('❌ DIAGNOSTIC FINAL:');
  try {
    const files = await fsPromises.readdir(path.dirname(pdfPath));
    console.error('📁 Fichiers dans le dossier:', files);
  } catch (dirError) {
    console.error('❌ Impossible de lire le dossier:', dirError.message);
  }
  
  throw new Error(`PDF non créé après ${maxRetries} tentatives: ${pdfPath}`);
}

app.post('/generate', async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  console.log('🚀 Début endpoint /generate');
  console.log('⏰ Timestamp début:', new Date().toISOString());
  
  try {
    // 🔍 DIAGNOSTIC 1: Vérifier LibreOffice
    console.log('🔍 DIAGNOSTIC 1: Vérification LibreOffice...');
    try {
      const { exec } = await import('child_process');
      await new Promise((resolve, reject) => {
        exec('libreoffice --version', (error, stdout, stderr) => {
          if (error) {
            console.error('❌ LibreOffice non trouvé:', error.message);
            console.error('❌ stderr:', stderr);
            reject(error);
          } else {
            console.log('✅ LibreOffice trouvé:', stdout.trim());
            resolve(stdout);
          }
        });
      });
    } catch (libreError) {
      console.error('❌ ERREUR CRITIQUE: LibreOffice non disponible');
      return res.status(500).json({
        error: 'LibreOffice non installé sur le serveur',
        details: libreError.message
      });
    }

    // Créer le dossier temp s'il n'existe pas
    const tempDir = path.join(__dirname, 'temp');
    
    // 🔍 DIAGNOSTIC 2: Vérifier permissions d'écriture
    console.log('🔍 DIAGNOSTIC 2: Vérification permissions...');
    console.log('📁 Dossier temp:', tempDir);
    
    if (!fs.existsSync(tempDir)) {
      console.log('📁 Création du dossier temp...');
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('✅ Dossier temp créé');
    } else {
      console.log('✅ Dossier temp existe déjà');
    }
    
    // Test d'écriture
    const testFile = path.join(tempDir, 'test-write.txt');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('✅ Permissions d\'écriture OK');
    } catch (writeError) {
      console.error('❌ ERREUR CRITIQUE: Pas de permissions d\'écriture');
      console.error('❌ Erreur:', writeError.message);
      return res.status(500).json({
        error: 'Permissions d\'écriture insuffisantes',
        details: writeError.message
      });
    }

    // 1. Générer le fichier .docx
    console.log('📄 Génération du fichier .docx...');
    const startDocx = Date.now();
    const result = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);
    const endDocx = Date.now();
    console.log(`✅ .docx généré en ${endDocx - startDocx}ms`);
    
    // Debug: vérifier ce qui est retourné
    console.log('✅ Résultat génération contrat:', result);
    console.log('📦 Résultat generateContrat:', Object.keys(result));
    console.log('📦 Taille du buffer:', result.buffer?.length);
    console.log('📦 Taille du docxBuffer:', result.docxBuffer?.length);
    console.log('📦 Type du rawBuffer:', typeof rawBuffer);
    console.log('📦 Est-ce un Buffer?', Buffer.isBuffer(rawBuffer));
    console.log('📦 Est-ce un Uint8Array?', rawBuffer instanceof Uint8Array);
    
    const rawBuffer = result.buffer || result.docxBuffer; // récupère buffer depuis l'objet retourné
    const docxPath = path.join(__dirname, `temp/contrat-${contrat_id}.docx`);
    const pdfPath = path.join(__dirname, `temp/contrat-${contrat_id}.pdf`);

    console.log('📁 Chemin .docx:', docxPath);
    console.log('📁 Chemin .pdf:', pdfPath);

    // Vérifier que le buffer existe
    if (!rawBuffer) {
      throw new Error('Aucun buffer retourné par generateContrat');
    }

    // Convertir Uint8Array en Buffer
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    
    console.log('📦 Buffer final pour écriture:', buffer.length, 'bytes');
    console.log('💾 Écriture du fichier .docx...');
    fs.writeFileSync(docxPath, buffer);
    console.log('✅ Fichier .docx écrit');
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(docxPath)) {
      throw new Error('Fichier .docx non créé après écriture');
    }
    console.log('✅ Fichier .docx confirmé sur disque');


    // 2. Convertir .docx → .pdf (utilise LibreOffice en ligne de commande)
    // 🔍 DIAGNOSTIC 3: Timeout et conversion
    console.log('🔍 DIAGNOSTIC 3: Conversion LibreOffice avec timeout...');
    console.log('🔄 Starting LibreOffice conversion...');
    const startConversion = Date.now();
    
    await new Promise((resolve, reject) => {
      const command = `libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`;
      console.log('⚙️ Commande LibreOffice:', command);
      
      // Timeout de 30 secondes pour la conversion
      const timeout = setTimeout(() => {
        console.error('❌ TIMEOUT: Conversion LibreOffice > 30s');
        reject(new Error('Timeout conversion LibreOffice (30s)'));
      }, 30000);
      
      exec(command, (err, stdout, stderr) => {
        clearTimeout(timeout);
        const endConversion = Date.now();
        console.log(`⏱️ Conversion terminée en ${endConversion - startConversion}ms`);
        
        if (err) {
          console.error('❌ Erreur conversion LibreOffice:', err.message);
          console.error('❌ stderr:', stderr);
          console.error('❌ stdout:', stdout);
          reject(err);
        } else {
          console.log('✅ LibreOffice command completed');
          console.log('📋 stdout:', stdout);
          if (stderr) {
            console.warn('⚠️ stderr:', stderr);
          }
          resolve();
        }
      });
    });

    // 2.5. Wait for PDF file to be created
    console.log('⏳ Attente création fichier PDF...');
    await waitForPdfFile(pdfPath);
    console.log('✅ Fichier PDF créé et détecté');
    
    // Vérifier la taille du PDF
    const pdfStats = fs.statSync(pdfPath);
    console.log('📊 Taille PDF:', pdfStats.size, 'bytes');
    
    if (pdfStats.size === 0) {
      throw new Error('Fichier PDF créé mais vide');
    }

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
    console.log('🧹 Fichiers temporaires supprimés');
    
    const totalTime = Date.now() - Date.parse(new Date().toISOString());
    console.log(`🎉 Processus complet terminé`);

  } catch (error) {
    console.error('❌ Erreur génération contrat :', error);
    console.error('❌ Stack trace:', error.stack);
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
  console.log('⏰ Timestamp début /convert:', new Date().toISOString());
  
  // 🔍 DIAGNOSTIC: Vérifier LibreOffice pour /convert aussi
  console.log('🔍 Vérification LibreOffice pour /convert...');
  try {
    const { exec } = await import('child_process');
    await new Promise((resolve, reject) => {
      exec('libreoffice --version', (error, stdout, stderr) => {
        if (error) {
          console.error('❌ LibreOffice non disponible pour /convert:', error.message);
          reject(error);
        } else {
          console.log('✅ LibreOffice OK pour /convert:', stdout.trim());
          resolve(stdout);
        }
      });
    });
  } catch (libreError) {
    console.error('❌ ERREUR: LibreOffice non disponible pour /convert');
    return res.status(500).json({
      error: 'LibreOffice non installé',
      details: libreError.message
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // 👈 Important : autorisation RLS
  );

  // Créer le dossier temp si besoin
  const tempDir = path.join(__dirname, 'temp');
  console.log('📁 Vérification dossier temp pour /convert:', tempDir);
  
  if (!fs.existsSync(tempDir)) {
    console.log('📁 Création dossier temp pour /convert...');
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('✅ Dossier temp créé pour /convert');
  } else {
    console.log('✅ Dossier temp existe pour /convert');
  }

  const docxPath = path.join(__dirname, `temp/contrat-${contratId}.docx`);
  const pdfPath = path.join(__dirname, `temp/contrat-${contratId}.pdf`);
  
  console.log('📁 Chemins pour /convert:');
  console.log('  - DOCX:', docxPath);
  console.log('  - PDF:', pdfPath);

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
    console.log('📦 Taille arrayBuffer:', arrayBuffer.byteLength, 'bytes');
    fs.writeFileSync(docxPath, Buffer.from(arrayBuffer));
    console.log('✅ Fichier .docx sauvegardé temporairement pour /convert');
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(docxPath)) {
      throw new Error('Fichier .docx non créé après sauvegarde');
    }
    const docxStats = fs.statSync(docxPath);
    console.log('📊 Fichier .docx confirmé, taille:', docxStats.size, 'bytes');

    // 4. Convertir .docx → .pdf avec LibreOffice
    console.log('🔄 Conversion .docx → .pdf...');
    const startConversion = Date.now();
    
    await new Promise((resolve, reject) => {
      const command = `libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`;
      console.log('⚙️ Commande LibreOffice /convert:', command);
      
      // Timeout de 30 secondes
      const timeout = setTimeout(() => {
        console.error('❌ TIMEOUT /convert: Conversion > 30s');
        reject(new Error('Timeout conversion /convert (30s)'));
      }, 30000);
      
      exec(command, (err, stdout, stderr) => {
        clearTimeout(timeout);
        const endConversion = Date.now();
        console.log(`⏱️ Conversion /convert terminée en ${endConversion - startConversion}ms`);
        
        if (err) {
          console.error('❌ Erreur LibreOffice /convert:', err.message);
          console.error('❌ stderr /convert:', stderr);
          console.error('❌ stdout /convert:', stdout);
          return reject(err);
        }
        console.log('✅ Conversion LibreOffice /convert terminée');
        console.log('📋 stdout /convert:', stdout);
        if (stderr) {
          console.warn('⚠️ stderr /convert:', stderr);
        }
        resolve();
      });
    });

    // 5. Attendre que le PDF soit créé
    console.log('⏳ Attente création PDF pour /convert...');
    await waitForPdfFile(pdfPath);

    // 6. Lire le PDF généré
    console.log('📖 Lecture du PDF généré...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('✅ PDF lu pour /convert, taille:', pdfBuffer.length, 'bytes');
    
    if (pdfBuffer.length === 0) {
      throw new Error('PDF généré mais vide');
    }

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
    console.log('🧹 Fichiers temporaires /convert supprimés');
    
    const totalTime = Date.now() - Date.parse(new Date().toISOString());
    console.log(`🎉 Processus /convert terminé`);
    
  } catch (error) {
    console.error('❌ Erreur endpoint /convert:', error.message);
    console.error('❌ Stack trace /convert:', error.stack);
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
