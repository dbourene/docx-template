// Signe un PDF en ajoutant une signature avec le nom, le rôle et la date du signataire
// et sauvegarde le PDF signé à un emplacement spécifié

import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Signature dans le PDF (clic d'acceptation)
 * @param {string} inputPdfPath - chemin du PDF d'origine
 * @param {string} outputPdfPath - chemin du PDF signé à sauvegarder
 * @param {object} signataire - informations du signataire
 * @param {string} signataire.nom - nom du signataire
 * @param {string} signataire.role - "consommateur" ou "producteur"
 * @param {string} signataire.date - date ISO
 */
export async function signPdf(inputPdfPath, outputPdfPath, signataire) {
  try {
    const existingPdfBytes = await fs.readFile(inputPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const text = `Signé par : ${signataire.nom} (${signataire.role}) le ${new Date(signataire.date).toLocaleString()}`;

    lastPage.drawText(text, {
      x: 50,
      y: 50, // marge basse
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPdfPath, pdfBytes);

    console.log(`✅ PDF signé et sauvegardé : ${outputPdfPath}`);
  } catch (error) {
    console.error('❌ Erreur lors de la signature du PDF :', error);
    throw error;
  }
}
