// services/updateAnnexe21AfterSignature.js

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import supabase from '../../lib/supabaseClient.js';

/**
 * Met à jour le fichier annexe21 dans Supabase Storage après signature du consommateur.
 * @param {string} contratId - ID du contrat signé (table contrats)
 */

// --- Fonction utilitaire pour extraire le chemin relatif depuis une URL publique ---
function extractStoragePath(publicUrl) {
  const match = publicUrl.match(/\/object\/public\/([^?]+)/);
  if (!match) throw new Error(`❌ URL Supabase Storage invalide: ${publicUrl}`);
  return match[1]; // ex: "annexes21/operations/mon_fichier.xlsx"
}

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

    // Étape 2 : Récupérer les infos du consommateur
    const { data: consommateur, error: consError } = await supabase
        .from('consommateurs')
        .select('prm, type, contact_prenom, contact_nom, denominationUniteLegale, adresse, siret')
        .eq('id', consommateurId)
        .maybeSingle();

    if (consError || !consommateur) {
        throw new Error(`❌ Erreur récupération consommateur: ${consError?.message}`);
    }

    const titulaire =
        consommateur.type === 'particulier'
            ? `${consommateur.contact_prenom} ${consommateur.contact_nom}`
            : consommateur.denominationUniteLegale;

    console.log(`📄 Données à injecter : PRM=${consommateur.prm}, Titulaire=${titulaire}, Adresse=${consommateur.adresse}, SIRET=${consommateur.siret}`);

    // Étape 3 : Récupération de l'opération (pour obtenir l'url_annexe21)
    const { data: operation, error: opError } = await supabase
      .from('operations')
      .select('url_annexe21')
      .eq('id', operationId)
      .maybeSingle();

    if (opError || !operation) {
      throw new Error(`❌ Erreur récupération operation: ${opError?.message}`);
    }

    // Etape 4 : Extraire le chemin relatif pour Supabase Storage
    const storagePath = extractStoragePath(operation.url_annexe21);
    console.log(`📂 Chemin relatif dans Supabase Storage: ${storagePath}`);

    // Etape 5 : Télécharger le fichier depuis Supabase
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('annexes21')
      .download(storagePath.replace(/^annexes21\//, ''));
    console.log(`📥 Fichier téléchargé depuis Supabase Storage: ${storagePath}`);

    if (downloadErr) throw downloadErr;
    if (!fileData) {
      throw new Error(`❌ Fichier annexe21 non trouvé pour l'opération ID: ${operationId}`);
    }
    
    // Sauvegarder temporairement le fichier téléchargé
    const tempFilePath = path.join('/tmp', 'annexe21.xlsx');
    const buffer = await fileData.arrayBuffer();
    fs.promises.writeFile(tempFilePath, Buffer.from(buffer));
    console.log(`💾 Fichier temporaire sauvegardé: ${tempFilePath}`);

    // Étape 6 : Charger le fichier Excel en mémoire avec ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);
    const sheet = workbook.getWorksheet('Consommateurs');
    console.log(`📊 Chargement du fichier Excel: ${tempFilePath}`);
    console.log(`📂 Onglet "Consommateurs" trouvé: ${sheet ? 'Oui' : 'Non'}`);
    if (!sheet) {
      throw new Error('❌ Onglet "Consommateurs" introuvable dans le fichier Excel');
    }
    
    // Étape 7 : Remplacer les balises dans la feuille "Consommateurs"
    sheet.eachRow((row, rowIndex) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'string') {
          cell.value = cell.value
            .replace('{{consommateurs.prm}}', consommateur.prm || '')
            .replace('{{consommateurs.titulaire}}', titulaire || '')
            .replace('{{consommateurs.adresse}}', consommateur.adresse || '')
            .replace('{{consommateurs.siret}}', consommateur.siret || '');
        }
      });
    });
    console.log(`✏️ Balises {{consommateurs.*}} remplacées dans la feuille "Consommateurs"`);

    // Étape 8 : Sauvegarde temporaire du fichier modifié
    const updatedFilePath = path.join('/tmp', 'annexe21_updated.xlsx');
    await workbook.xlsx.writeFile(updatedFilePath);
    console.log(`💾 Fichier modifié temporairement sauvegardé dans ${updatedFilePath}`);

    // Étape 9 : Reupload dans Supabase Storage
    const fileBuffer = await fs.promises.readFile(updatedFilePath);
    const { error: uploadErr } = await supabase.storage
      .from('annexes21')
      .upload(storagePath.replace(/^annexes21\//, ''), fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true, // écrase le fichier existant
      });

    if (uploadErr) {
      throw new Error(`❌ Erreur lors du reupload du fichier modifié : ${uploadErr.message}`);
    }

    console.log(`✅ Fichier Excel mis à jour et remplacé dans Supabase Storage`);

    // Étape 10 : Suppression du fichier temporaire
    await fs.promises.unlink(updatedFilePath);

  } catch (err) {
    console.error('❌ Erreur dans updateAnnexe21AfterSignature:', err.message);
    return { success: false, error: err.message };
  }
}