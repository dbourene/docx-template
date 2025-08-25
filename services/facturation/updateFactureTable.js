// services/facturation/updateFactureTable.js

import { supabase } from '../../supabase.js';

/**
 * Insère une nouvelle facture dans la table "factures"
 * @param {Object} params - Données nécessaires à l'insertion
 * @param {string} params.contrat_id - UUID du contrat lié à la facture
 * @param {string} params.consommateur_prm - PRM du consommateur (pas inséré ici, mais utile pour suivi/notifications)
 * @param {string} params.producteur_prm - PRM du producteur
 * @param {string} params.numero - Numéro de facture séquentiel (ex: FAC-12345678901234_001)
 * @param {string} params.url - URL publique du PDF de facture stocké dans Supabase
 * @param {string} params.type_facture - Type de facture ("facture" ou "avoir")
 * @returns {Object} Enregistrement de la facture insérée
 */
export async function updateFactureTable({
  contrat_id,
  consommateur_prm,
  producteur_prm,
  numero,
  url,
  type_facture
}) {
  try {
    console.log(`💾 Insertion de la facture ${numero} dans la table factures...`);

    const now = new Date();
    const date_facture = now.toISOString();
    const date_reglement_du = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // +5 jours

    const { data, error } = await supabase
      .from('factures')
      .insert([
        {
          contrat_id,
          date_facture,
          date_reglement_du,
          facture_url: url,
          date_notification: null, // sera rempli après envoi du mail
          type_facture,
          producteur_prm,
          numero,
        }
      ])
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Facture ${numero} insérée avec succès (contrat ${contrat_id})`);
    return data;

  } catch (error) {
    console.error('❌ Erreur lors de l’insertion de la facture :', error);
    throw error;
  }
}
