// services/facturation/generateFactureDocx.js

import fs from 'fs/promises';
import { createReport } from 'docx-templates';

/**
 * Génère le fichier DOCX de facture à partir du template et des données
 * @param {string} templateFile - Chemin vers le template DOCX téléchargé localement
 * @param {{ templateData: Object, numero_acc: string }} factureData - Données générées (templateData + numero_acc)
 * @param {string} outputDocx - Chemin du fichier de sortie .docx
 */
export async function generateFactureDocx(templateFile, factureData, outputDocx) {
  try {
    console.log('📝 Génération du DOCX de facture...');

    // 1️⃣ Lire le template depuis le disque
    const template = await fs.readFile(templateFile);

    // 2️⃣ Générer le rapport DOCX avec docx-templates
    const report = await createReport({
      template,
      data: factureData.templateData, // ⚡ On utilise seulement templateData ici
      cmdDelimiter: ['<<', '>>'],
      processLineBreaks: true,
    });

    // 3️⃣ Écrire le résultat dans un fichier temporaire
    await fs.writeFile(outputDocx, report);

    console.log(`✅ Facture DOCX générée : ${outputDocx}`);
    return outputDocx;
  } catch (error) {
    console.error('❌ Erreur lors de la génération du DOCX de facture :', error);
    throw error;
  }
}
