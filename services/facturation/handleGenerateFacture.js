// services/facturation/handleGenerateFacture.js

import path from 'path';
import fs from 'fs/promises';
import { downloadTemplateLocally } from '../common/downloadTemplateLocally.js';
import { convertDocxToPdf } from '../common/convertDocxToPdf.js';
import { uploadToSupabase } from '../common/uploadToSupabase.js';
import { generateFactureData } from './generateFactureData.js';
import { generateFactureDocx } from './generateFactureDocx.js';
import { updateFactureTable } from './updateFactureTable.js';
import { notifyConsommateur } from './notifyConsommateur.js';
import { generateNumeroFacture } from './generateNumeroFacture.js';

/**
 * Flux complet de génération de facture
 * @param {string} consommateur_prm - PRM du consommateur
 * @param {string} producteur_prm - PRM du producteur
 * @param {string} contrat_id - UUID du contrat lié
 * @param {string} operationId - UUID de l'opération
 * @param {string} startDate - date de début au format YYYYMMDDTHHMMSSZ
 * @param {string} endDate - date de fin au format YYYYMMDDTHHMMSSZ
 * @returns {Promise<string>} - Résultat de l'opération avec succès ou erreur
 */
export async function handleGenerateFacture(consommateur_prm, producteur_prm, contrat_id, operationId, startDate, endDate) {
  try {
    console.log('🚀 Début génération facture pour consommateur', consommateur_prm, 'et producteur', producteur_prm);

    // 1️⃣ Générer le numéro séquentiel pour ce producteur
    const numero = await generateNumeroFacture(producteur_prm);
    console.log(`📑 Nouveau numéro de facture généré : ${numero}`);

    // 2️⃣ Générer les données de facturation
    const { templateData, numero_acc } = await generateFactureData(consommateur_prm, producteur_prm, numero, operationId, startDate, endDate);

    // 3️⃣ Télécharger le template facture depuis Supabase Storage
    const templateFile = await downloadTemplateLocally('facture_template_V0_1.docx', 'factures');
    console.log('📄 Template de facture téléchargé localement :', templateFile);
    
    // 4️⃣ Générer le .docx rempli avec les données
    const outputDocx = path.join(process.cwd(), 'temp', `FA-${producteur_prm}_${numero}.docx`);
    await generateFactureDocx(templateFile, { templateData, numero_acc }, outputDocx);

    // 5️⃣ Convertir en PDF
    const outputDir = path.join(process.cwd(), 'temp');
    const pdfPath = await convertDocxToPdf(outputDocx, outputDir);

    // 6️⃣ Uploader dans Supabase Storage
    const now = new Date();
    const prevMonth = new Date(now);
    prevMonth.setMonth(now.getMonth() - 1);

    const annee = prevMonth.getFullYear();
    const mois = String(prevMonth.getMonth() + 1).padStart(2, '0');
    const storagePath = `factures/${numero_acc}/${annee}/${mois}/FA-${producteur_prm}_${numero}.pdf`;

    const { publicUrl } = await uploadToSupabase(pdfPath, storagePath, 'factures');

    console.log('⬆️ Facture PDF uploadée vers Supabase Storage :', publicUrl);

    // 7️⃣ Mettre à jour la table factures
    const factureRecord = await updateFactureTable({
      contrat_id,
      consommateur_prm,
      producteur_prm,
      numero: numero,
      url: publicUrl,
      type_facture: 'facture',
    });
    console.log('🗃️ Table factures mise à jour avec la nouvelle facture, ID:', factureRecord.id);
    
    // 8️⃣ Notifier le consommateur par email
    let prm_nom;

    if (templateData.producteur_particulier) {
      // Si producteur particulier → prénom
      prm_nom = templateData.producteur_contact_prenom;
    } else if (templateData.producteur_entreprise) {
      // Si producteur entreprise → dénomination légale (ou sigle si dispo)
      prm_nom = templateData.producteur_denominationUniteLegale !== '[DENOMINATION_ABSENTE]'
        ? templateData.producteur_denominationUniteLegale
        : templateData.producteur_sigleUniteLegale;
    } else {
      prm_nom = '[NOM_PRODUCTEUR_ABSENT]';
    }
    
    await notifyConsommateur({
      facture_id: factureRecord.id,
      numero: factureRecord.numero,
      facture_url: publicUrl,
      email_consommateur: templateData.consommateur_contact_email,
      prm_nom,
    });

    console.log('✅ Facture générée, stockée et consommateur notifié');
    return {
      success: true,
      details: {
        facture_id: factureRecord.id,
        numero: factureRecord.numero,
        url: factureRecord.url,
        consommateur_prm,
        producteur_prm,
      }
    };

  } catch (error) {
    console.error('❌ Erreur lors de la génération de la facture :', error);
    return {
      success: false,
      error: error.message || 'Erreur inconnue lors de la génération de la facture',
    };
  }
}