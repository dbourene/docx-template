// services/updateAnnexe21AfterSignature.js

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import supabase from '../../lib/supabaseClient.js';

/**
 * Met à jour le fichier annexe21 dans Supabase Storage après signature du consommateur.
 * @param {string} contratId - ID du contrat signé (table contrats)
 */
export async function updateAnnexe21AfterSignature(contratId) {
  try {
    console.log(`🔁 Démarrage mise à jour annexe21 pour contrat ID: ${contratId}`);

    // Étape 1 : Récupération de l'opération liée au contrat
    const { data: contrat, error: contratError } = await supabase
      .from('contrats')
      .select('id, consommateur_id, operation_id')
      .eq('id', contratId)
      .maybeSingle();

    if (contratError || !contrat) {
      throw new Error(`❌ Erreur récupération contrat: ${contratError?.message}`);
    }

    const consommateurId = contrat.consommateur_id;
    const operationId = contrat.operation_id;

    // Étape 2 : Récupération de l'opération (pour obtenir l'url_annexe21)
    const { data: operation, error: opError } = await supabase
      .from('operations')
      .select('url_annexe21')
      .eq('id', operationId)
      .maybeSingle();

    if (opError || !operation) {
      throw new Error(`❌ Erreur récupération operation: ${opError?.message}`);
    }

    const fileUrl = operation.url_annexe21;

    // Étape 3 : Extraire le chemin dans Supabase Storage à partir de l'URL
    const parts = fileUrl.split('/object/public/operations/');
    const relativePath = parts[1];

    if (!relativePath) {
      throw new Error(`❌ URL Supabase Storage invalide: ${fileUrl}`);
    }

    console.log(`📂 Fichier à modifier dans Storage: ${relativePath}`);

    // Étape 4 : Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('operations')
      .download(relativePath);

    if (fileError || !fileData) {
      throw new Error(`❌ Erreur téléchargement fichier XLSX: ${fileError?.message}`);
    }

    // Étape 5 : Charger le fichier Excel en mémoire avec ExcelJS
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Consommateurs');

    if (!sheet) {
      throw new Error('❌ Onglet "Consommateurs" introuvable dans le fichier Excel');
    }

    // Étape 6 : Récupérer les infos du consommateur
    const { data: consommateur, error: consError } = await supabase
      .from('consommateurs')
      .select('prm, type, contact_prenom, contact_nom, denominationUniteLegale, adresse')
      .eq('id', consommateurId)
      .maybeSingle();

    if (consError || !consommateur) {
      throw new Error(`❌ Erreur récupération consommateur: ${consError?.message}`);
    }

    const titulaire =
      consommateur.type === 'particulier'
        ? `${consommateur.contact_prenom} ${consommateur.contact_nom}`
        : consommateur.denominationUniteLegale;

    console.log(`📄 Données à injecter : PRM=${consommateur.prm}, Titulaire=${titulaire}, Adresse=${consommateur.adresse}`);

    // Étape 7 : Remplacer les balises dans la feuille "Consommateurs"
    sheet.eachRow((row, rowIndex) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'string') {
          if (cell.value.includes('{{consommateurs.prm}}')) {
            cell.value = cell.value.replace('{{consommateurs.prm}}', consommateur.prm);
          }
          if (cell.value.includes('{{consommateurs.titulaire}}')) {
            cell.value = cell.value.replace('{{consommateurs.titulaire}}', titulaire);
          }
          if (cell.value.includes('{{consommateurs.adresse}}')) {
            cell.value = cell.value.replace('{{consommateurs.adresse}}', consommateur.adresse);
          }
        }
      });
    });

    // Étape 8 : Sauvegarde temporaire du fichier modifié
    const tmpPath = path.join(process.cwd(), 'tmp_annexe21.xlsx');
    await workbook.xlsx.writeFile(tmpPath);
    console.log(`💾 Fichier modifié temporairement sauvegardé dans ${tmpPath}`);

    // Étape 9 : Reupload dans Supabase Storage
    const fileBuffer = await fs.readFile(tmpPath);
    const { error: uploadError } = await supabase
      .storage
      .from('operations')
      .upload(relativePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`❌ Erreur lors du reupload du fichier modifié : ${uploadError.message}`);
    }

    console.log(`✅ Fichier Excel mis à jour et remplacé dans Supabase Storage`);

    // Étape 10 : Suppression du fichier temporaire
    await fs.unlink(tmpPath);

  } catch (error) {
    console.error('🚨 Erreur dans updateAnnexe21AfterSignature:', error);
    throw error;
  }
}
