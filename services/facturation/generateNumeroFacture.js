// services/facturation/generateNumeroFacture.js

import supabase from '../../lib/supabaseClient.js';

/**
 * Génère un nouveau numéro de facture séquentiel pour un producteur donné
 * @param {string} producteur_prm - Identifiant unique du producteur (PRM)
 * @returns {string} - Numéro de facture formaté (ex: "000001")
 */
export async function generateNumeroFacture(producteur_prm) {
  try {
    console.log(`🔎 Recherche du dernier numéro de facture pour producteur ${producteur_prm}...`);

    // On récupère la facture la plus récente pour ce producteur
    const { data, error } = await supabase
      .from('factures')
      .select('numero')
      .eq('producteur_prm', producteur_prm)
      .eq('type_facture', 'facture') // uniquement les factures, pas les avoirs
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur lors de la récupération du dernier numéro de facture: ${error.message}`);
    }

    let nextNumero = 1;
    if (data && data.numero) {
      nextNumero = parseInt(data.numero, 10) + 1;
    }

    // Format sur 6 chiffres avec padding (ex: "000123")
    const formattedNumero = String(nextNumero).padStart(6, '0');

    console.log(`✅ Nouveau numéro généré pour producteur ${producteur_prm}: ${formattedNumero}`);
    return formattedNumero;

  } catch (err) {
    console.error('❌ Erreur generateNumeroFacture:', err);
    throw err;
  }
}
