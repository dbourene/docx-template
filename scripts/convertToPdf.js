import { exec } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Convertit un fichier .docx en .pdf à l'aide de LibreOffice
 * @param {string} inputPath - chemin absolu ou relatif vers le fichier .docx
 * @param {string} outputDir - répertoire où enregistrer le PDF généré
 * @returns {Promise<string>} - chemin complet vers le fichier .pdf généré
 */
export async function convertDocxToPdf(inputPath, outputDir) {
  const filenameWithoutExt = path.basename(inputPath, '.docx');
  const outputPath = path.join(outputDir, `${filenameWithoutExt}.pdf`);

  return new Promise((resolve, reject) => {
    const command = `libreoffice --headless --convert-to pdf "${inputPath}" --outdir "${outputDir}"`;

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur lors de la conversion DOCX → PDF :', stderr);
        return reject(error);
      }

      // Vérifie que le fichier PDF a bien été généré
      try {
        await fs.access(outputPath);
        resolve(outputPath);
      } catch (fsError) {
        reject(new Error(`Fichier PDF non trouvé après conversion : ${outputPath}`));
      }
    });
  });
}
