// Signe un PDF en ajoutant une signature avec le nom, le rôle et la date du signataire
// et sauvegarde le PDF signé à un emplacement spécifié

import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Signature dans le PDF (clic d'acceptation)
 * @param {Buffer} pdfBuffer - Buffer du PDF à signer
 * @param {string} outputPdfPath - Chemin où sauvegarder le PDF signé
 * @param {object} signataire - Informations du signataire
 * @param {string} signataire.id - ID du signataire
 * @param {string} signataire.role - "consommateur" ou "producteur"
 * @param {string} signataire.date - Date ISO
 */
export default async function signPdf(pdfBuffer, outputPdfPath, signataire = {
  id: 'ID inconnu',
  role: 'consommateur',
  date: new Date().toISOString()
}) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const text = `Signé par : ${signataire.id} (${signataire.role}) le ${new Date(signataire.date).toLocaleString()}`;

    lastPage.drawText(text, {
      x: 50,
      y: 50, // marge basse
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const signedPdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPdfPath, signedPdfBytes);

    console.log(`✅ PDF signé et sauvegardé : ${outputPdfPath}`);
  } catch (error) {
    console.error('❌ Erreur lors de la signature du PDF :', error);
    throw error;
  }
}
