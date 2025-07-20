import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateContrat } from './scripts/generateContrat.js';


// Configuration pour Docker/Render
const tempDir = path.join('/app', 'temp');
const PORT = process.env.PORT || 3001;

// Créer le dossier temp au démarrage
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
  console.log('📁 Dossier temp créé');
}

// Bloc try/catch global pour éviter les crashs
process.on('uncaughtException', (error) => {
  console.error('❌ ERREUR NON GÉRÉE:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMESSE REJETÉE NON GÉRÉE:', reason);
  process.exit(1);
});

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vérification de LibreOffice au démarrage
const checkLibreOffice = () => {
  return new Promise((resolve) => {
    exec('libreoffice --version', (err, stdout, stderr) => {
      if (err) {
        console.error('❌ LibreOffice non disponible:', stderr || err.message);
        resolve(false);
      } else {
        console.log('✅ LibreOffice détecté:', stdout.trim());
        resolve(true);
      }
    });
  });
};

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

    // Vérifier LibreOffice
    const libreOfficeOk = await checkLibreOffice();
    if (!libreOfficeOk) {
      throw new Error('LibreOffice non disponible pour la conversion PDF');
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
    const rawBuffer = result.buffer || result.docxBuffer;
    
    if (!rawBuffer) {
      throw new Error('Aucun buffer retourné par generateContrat');
    }

    // Conversion correcte du buffer
    const docxBuffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    console.log('📦 Buffer récupéré, taille:', docxBuffer.length, 'bytes');

    // Chemins des fichiers dans /app/temp/
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
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Conversion PDF > 30 secondes'));
      }, 30000);

      exec(conversionCommand, (err, stdout, stderr) => {
        clearTimeout(timeout);
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

    if (pdfStats.size === 0) {
      throw new Error('PDF généré mais vide');
    }

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

    // 7. Uploader le PDF dans Supabase Storage (même emplacement que le .docx)
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Utiliser le même nom que le .docx mais avec extension .pdf
    const pdfFileName = result.fileName.replace('.docx', '.pdf');
    const pdfStoragePath = `consommateurs/${pdfFileName}`;

    console.log('⬆️ Upload du PDF vers Supabase:', pdfStoragePath);

    const { error: uploadError } = await supabase.storage
      .from('contrats')
      .upload(pdfStoragePath, Buffer.from(modifiedPdfBytes), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Erreur upload vers Supabase:', uploadError.message);
      throw new Error('Erreur lors de l’upload du fichier PDF dans Supabase');
    }

    // 8. Obtenir l'URL publique
    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from('contrats')
      .getPublicUrl(pdfStoragePath);

    if (publicUrlError) {
      throw new Error('Erreur lors de la récupération de l’URL publique du PDF');
    }

    const publicUrl = publicUrlData?.publicUrl;
    console.log('✅ Fichier PDF uploadé. URL:', publicUrl);

    // 9. Mettre à jour la table contrats après signature électronique
    console.log('🔄 Mise à jour de la table contrats...');
    const { error: updateContratError } = await supabase
      .from('contrats')
      .update({
        url_consommateur: urlData.publicUrl,
        statut: 'attente_prod'
      })
      .eq('id', contrat_id);

    if (updateContratError) {
      console.error('❌ Erreur mise à jour contrat:', updateContratError.message);
      throw new Error(`Erreur lors de la mise à jour du contrat: ${updateContratError.message}`);
    }

    console.log('✅ Contrat mis à jour:');
    console.log('  - url_consommateur:', urlData.publicUrl);
    console.log('  - statut: attente_prod');

    // 10. Répondre au client
    console.log('🎉 Contrat généré avec succès:');
    console.log('  Fichier DOCX:', fs.existsSync(docxPath) ? 'Créé' : 'MANQUANT');
    console.log('  Fichier PDF:', fs.existsSync(pdfPath) ? 'Créé' : 'MANQUANT');
    
    res.status(200).json({
      success: true,
      fileName: pdfFileName,
      url: publicUrl,
      message: 'Contrat généré, signé et uploadé dans Supabase avec succès'
    });

    // 11. Nettoyage des fichiers temporaires
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
        console.error('⚠️ Erreur lors du nettoyage:', cleanupError.message);
      }
    }, 2000);

  } catch (error) {
    console.error('❌ ERREUR ENDPOINT /generate:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      endpoint: '/generate'
    });
  }
});

// Endpoint pour convertir un .docx existant en PDF
app.post('/convert', async (req, res) => {
  const { contrat_id } = req.body;
  
  if (!contrat_id) {
    return res.status(400).json({ error: 'contrat_id manquant' });
  }

  console.log('🔄 Début conversion PDF pour contrat:', contrat_id);

  try {
    // Vérifier LibreOffice
    const libreOfficeOk = await checkLibreOffice();
    if (!libreOfficeOk) {
      throw new Error('LibreOffice non disponible pour la conversion PDF');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const docxPath = path.join(tempDir, `contrat-${contrat_id}.docx`);
    const pdfPath = path.join(tempDir, `contrat-${contrat_id}.pdf`);

    // 1. Trouver le fichier .docx dans le bucket 'contrats'
    console.log('🔍 Recherche du fichier .docx dans le bucket contrats...');
    
    const { data: files, error: listError } = await supabase.storage
      .from('contrats')
      .list('consommateurs', {
        search: `contrat-${contrat_id}`
      });

    if (listError) {
      throw new Error(`Erreur recherche fichier: ${listError.message}`);
    }

    const docxFile = files?.find(file => file.name.includes(`contrat-${contrat_id}`) && file.name.endsWith('.docx'));

    if (!docxFile) {
      throw new Error(`Fichier .docx non trouvé pour le contrat ${contrat_id}`);
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
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Conversion PDF > 30 secondes'));
      }, 30000);

      exec(`libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${tempDir}"`, (err, stdout, stderr) => {
        clearTimeout(timeout);
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
    setTimeout(() => {
      try {
        if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        console.log('🧹 Fichiers temporaires supprimés (/convert)');
      } catch (cleanupError) {
        console.error('⚠️ Erreur nettoyage:', cleanupError.message);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ ERREUR ENDPOINT /convert:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      endpoint: '/convert'
    });
  }
});

// Démarrer le serveur
app.listen(PORT, async () => {
  console.log(`🟢 Serveur lancé sur le port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Dossier temp: ${tempDir}`);
  
  // Vérification initiale de LibreOffice
  const libreOfficeOk = await checkLibreOffice();
  if (!libreOfficeOk) {
    console.error('⚠️ ATTENTION: LibreOffice non disponible - les conversions PDF échoueront');
  }
  
  console.log('🚀 Serveur prêt à traiter les requêtes');
});