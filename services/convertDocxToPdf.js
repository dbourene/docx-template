// Convertit un fichier .docx en .pdf en utilisant LibreOffice
// Télécharge le fichier depuis Supabase Storage, le convertit et le sauvegarde

import { exec } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import supabase from '../utils/supabaseClient.js';

/**
 * Télécharge un fichier .docx depuis Supabase Storage et le convertit en .pdf à l'aide de LibreOffice
 * @param {string} docxPath - chemin du fichier dans Supabase Storage (ex: "consommateurs/CPV_ProducteurNom_ConsommateurNom.docx")
 * @param {string} outputDir - répertoire où enregistrer le PDF généré
 * @returns {Promise<string>} - chemin complet vers le fichier .pdf généré
 */
export async function convertDocxToPdf(docxPath, outputDir) {
  console.log('🚀 Début de la conversion DOCX → PDF');
  console.log('📁 Chemin Supabase Storage:', docxPath);
  console.log('📂 Dossier de sortie:', outputDir);

  try {
    // Étape 1: Télécharger le fichier .docx depuis Supabase Storage
    console.log('⬇️ Téléchargement du fichier .docx depuis Supabase Storage...');
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contrats')
      .download(docxPath);

    if (downloadError) {
      console.error('❌ Erreur lors du téléchargement:', downloadError);
      throw new Error(`Impossible de télécharger le fichier depuis Supabase Storage: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error(`Fichier non trouvé dans Supabase Storage: ${docxPath}`);
    }

    console.log('✅ Fichier téléchargé depuis Supabase Storage, taille:', fileData.size, 'bytes');

    // Étape 2: Sauvegarder temporairement le fichier .docx
    const fileName = path.basename(docxPath);
    const tempDocxPath = path.join('./temp/', fileName);
    
    console.log('💾 Sauvegarde temporaire du fichier:', tempDocxPath);
    
    // Convertir le Blob en Buffer pour l'écriture
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Créer le dossier temp s'il n'existe pas
    await fs.mkdir('./temp/', { recursive: true });
    
    // Écrire le fichier temporaire
    await fs.writeFile(tempDocxPath, buffer);
    
    console.log('✅ Fichier .docx sauvegardé temporairement');

    // Étape 3: Conversion en PDF (logique existante adaptée)
    const filenameWithoutExt = path.basename(tempDocxPath, '.docx');
    const outputPath = path.join(outputDir, `${filenameWithoutExt}.pdf`);

    console.log('🔄 Conversion DOCX → PDF avec LibreOffice...');
    console.log('📄 Fichier source:', tempDocxPath);
    console.log('📄 Fichier destination:', outputPath);

    return new Promise((resolve, reject) => {
      const command = `libreoffice --headless --convert-to pdf "${tempDocxPath}" --outdir "${outputDir}"`;
      
      console.log('⚙️ Commande LibreOffice:', command);

      exec(command, async (error, stdout, stderr) => {
        try {
          if (error) {
            console.error('❌ Erreur lors de la conversion DOCX → PDF:', stderr);
            return reject(new Error(`Erreur LibreOffice: ${stderr || error.message}`));
          }

          console.log('📋 Sortie LibreOffice:', stdout);

          // Vérifier que le fichier PDF a bien été généré
          try {
            await fs.access(outputPath);
            console.log('✅ Fichier PDF généré avec succès:', outputPath);
            
            // Nettoyer le fichier temporaire .docx
            try {
              await fs.unlink(tempDocxPath);
              console.log('🧹 Fichier temporaire .docx supprimé');
            } catch (cleanupError) {
              console.warn('⚠️ Impossible de supprimer le fichier temporaire:', cleanupError.message);
            }
            
            resolve(outputPath);
          } catch (fsError) {
            reject(new Error(`Fichier PDF non trouvé après conversion: ${outputPath}`));
          }
        } catch (asyncError) {
          reject(asyncError);
        }
      });
    });

  } catch (error) {
    console.error('❌ Erreur générale dans convertDocxToPdf:', error);
    throw error;
  }
}
