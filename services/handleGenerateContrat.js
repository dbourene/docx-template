// Orchestre le flux de génération d'un contrat CPV
// en récupérant les données nécessaires et en créant le document final




import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateContrat } from './generateContrat.js';
import { supabase } from '../lib/supabaseClient.js';

export const handleGenerateContrat = async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  console.log('🚀 Début endpoint /generate');
  console.log('📋 Paramètres reçus:', req.body);

  try {
    console.log('📄 Génération du fichier .docx...');

    const generationResult = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);

    if (!generationResult.success || !generationResult.hasDocxBuffer) {
      throw new Error('La génération du contrat a échoué');
    }

    const docxBuffer = generationResult.docxBuffer;
    const docxFileName = `contrat-${contrat_id}.docx`;
    const pdfFileName = `contrat-${contrat_id}.pdf`;

    const tempDir = path.join('/app', 'temp');
    const docxPath = path.join(tempDir, docxFileName);
    const pdfPath = path.join(tempDir, pdfFileName);

    console.log('📦 Buffer récupéré, taille:', docxBuffer.length, 'bytes');

    await fs.promises.writeFile(docxPath, docxBuffer);
    console.log('✅ Fichier .docx créé avec succès:', docxPath);

    const libreOfficeCmd = `libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${tempDir}"`;
    console.log('🔄 Conversion .docx → .pdf avec LibreOffice...');
    console.log('⚙️ Commande LibreOffice:', libreOfficeCmd);

    await new Promise((resolve, reject) => {
      exec(libreOfficeCmd, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        console.log('📋 LibreOffice stdout:', stdout);
        resolve();
      });
    });

    let attempts = 0;
    while (!fs.existsSync(pdfPath) && attempts < 10) {
      console.log('⏳ Attente de la création du fichier PDF...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error('Le fichier PDF n’a pas été généré');
    }

    const pdfBuffer = await fs.promises.readFile(pdfPath);
    console.log('✅ PDF créé avec succès:', pdfPath);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    firstPage.drawText('Signé électroniquement par le consommateur', {
      x: 50,
      y: 50,
      size: 12,
      color: rgb(0, 0.53, 0.71)
    });

    const signedPdfBytes = await pdfDoc.save();

    const pdfUploadPath = `contrats/consommateurs/${pdfFileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contrats')
      .upload(pdfUploadPath, Buffer.from(signedPdfBytes), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Erreur lors de l'upload du fichier PDF: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('contrats')
      .getPublicUrl(pdfUploadPath);

    const publicUrl = urlData.publicUrl;

    await supabase
      .from('contrats')
      .update({ statut: 'SIGNATURE_CONSOMMATEUR_OK', url_contrat_pdf: publicUrl })
      .eq('id', contrat_id);

    console.log('🎉 Contrat généré avec succès!');
    console.log('🔗 URL:', publicUrl);

    res.status(200).json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('❌ Erreur generation contrat:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
