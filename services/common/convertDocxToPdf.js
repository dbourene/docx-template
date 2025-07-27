// Convertit un fichier .docx local → .pdf local

import { exec } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Convertit un fichier .docx local en .pdf via LibreOffice
 * @param {string} docxPathLocal - chemin absolu vers le fichier .docx local
 * @param {string} outputDir - répertoire de sortie pour le fichier .pdf
 * @returns {Promise<string>} - chemin absolu vers le fichier PDF généré
 */
export async function convertDocxToPdf(docxPathLocal, outputDir) {
  console.log('🚀 Début de la conversion DOCX → PDF');
  console.log('📄 Fichier source local:', docxPathLocal);
  console.log('📂 Dossier de sortie:', outputDir);

  try {
    const filenameWithoutExt = path.basename(docxPathLocal, '.docx');
    const outputPath = path.join(outputDir, `${filenameWithoutExt}.pdf`);

    return new Promise((resolve, reject) => {
      const command = `libreoffice --headless --convert-to pdf "${docxPathLocal}" --outdir "${outputDir}"`;

      console.log('⚙️ Commande LibreOffice:', command);

      exec(command, async (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Erreur conversion:', stderr);
          return reject(new Error(`Erreur LibreOffice: ${stderr || error.message}`));
        }

        console.log('📋 LibreOffice stdout:', stdout);

        try {
          await fs.access(outputPath);
          console.log('✅ Fichier PDF généré avec succès:', outputPath);
          resolve(outputPath);
        } catch {
          reject(new Error(`Fichier PDF non trouvé: ${outputPath}`));
        }
      });
    });

  } catch (error) {
    console.error('❌ Erreur dans convertDocxToPdf:', error);
    throw error;
  }
}
