// Orchestre le flux de génération d'un contrat CPV
// Génère le .docx, le convertit en PDF, le signe, l'upload et met à jour la BDD

import fs from 'fs';
import path from 'path';
import { generateContrat } from './generateContrat.js';
import { convertDocxToPdf } from './convertDocxToPdf.js';
import signPdf from './signPdf.js';
import { uploadToSupabase } from './uploadToSupabase.js';
import { updateContratInDatabase } from './updateContratInDatabase.js';

export const handleGenerateContrat = async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  console.log('🚀 Début endpoint /generate');
  console.log('📋 Paramètres reçus:', req.body);

  try {
    // Étape 0 : Vérification
    if (!contrat_id || !consommateur_id || !producteur_id || !installation_id) {
      throw new Error('Tous les identifiants sont requis');
    }

    // Étape 1 : Génération du .docx
    console.log('📄 Génération du fichier .docx...');
    const generationResult = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);

    if (!generationResult.success || !generationResult.docxBuffer) {
      throw new Error('La génération du contrat a échoué');
    }

    const docxBuffer = generationResult.docxBuffer;
    const tempDir = path.join('/app', 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true }); // Assure que le dossier existe

    const docxFileName = `contrat-${contrat_id}.docx`;
    const pdfFileName = `contrat-${contrat_id}.pdf`;
    const signedPdfFileName = `contrat-${contrat_id}-signed.pdf`;

    const docxPath = path.join(tempDir, docxFileName);
    const signedPdfPath = path.join(tempDir, signedPdfFileName);

    console.log('📦 Buffer récupéré, taille:', docxBuffer.length, 'bytes');
    await fs.promises.writeFile(docxPath, docxBuffer);
    console.log('✅ Fichier .docx écrit:', docxPath);

    // Étape 2 : Conversion DOCX → PDF
    const pdfPath = await convertDocxToPdf(docxPath, tempDir);
    console.log('✅ PDF généré:', pdfPath);

    // Étape 3 : Lecture du PDF en buffer
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    console.log('📄 PDF lu en mémoire, taille:', pdfBuffer.length, 'octets');

    // Étape 4 : Signature
    await signPdf(pdfBuffer, signedPdfPath);
    console.log('✅ PDF signé:', signedPdfPath);

    // Étape 5 : Upload vers Supabase
    const supabasePath = `consommateurs/${signedPdfFileName}`; // <-- chemin relatif dans le bucket
    const bucket = 'contrats'; // <-- nom correct du bucket
    const { publicUrl, fullPath } = await uploadToSupabase(signedPdfPath, supabasePath, bucket);

    // Étape 6 : Mise à jour BDD
    await updateContratInDatabase(contrat_id, {
      statut: 'SIGNATURE_CONSOMMATEUR_OK',
      url_document: publicUrl // colonne renommée
    });

    console.log('🎉 Contrat généré et signé avec succès!');
    console.log('🔗 URL:', publicUrl);

    // Étape 7 : Réponse client
    res.status(200).json({ success: true, url: publicUrl });

    // Étape 8 : Nettoyage (optionnel)
    try {
      await fs.promises.unlink(docxPath);
      await fs.promises.unlink(pdfPath);
      await fs.promises.unlink(signedPdfPath);
      console.log('🧹 Fichiers temporaires supprimés');
    } catch (cleanupErr) {
      console.warn('⚠️ Erreur nettoyage fichiers:', cleanupErr.message);
    }

  } catch (error) {
    console.error('❌ Erreur generation contrat:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
