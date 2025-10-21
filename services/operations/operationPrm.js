// services/operations/operationPrm.js
// Insère les PRM liés à une opération dans la table operation_prms

import supabase from '../../lib/supabaseClient.js';

export const operationPrm = async (operation_id) => {
  console.log('🚀 Début de operationPrm pour operation_id =', operation_id);

  try {
    // 1️⃣ Récupération de l'opération
    const { data: operation, error: opError } = await supabase
      .from('operations')
      .select('id, numero_acc, producteur_id, start_date')
      .eq('id', operation_id)
      .single();

    if (opError || !operation) {
      throw new Error('Impossible de récupérer les informations de l’opération');
    }

    const { numero_acc, producteur_id, start_date } = operation;
    console.log(`📄 Opération trouvée : ACC ${numero_acc}, producteur ${producteur_id}`);

    // 2️⃣ Récupération des contrats liés à ce producteur
    const { data: contrats, error: contratsError } = await supabase
      .from('contrats')
      .select('id, consommateur_id, installation_prm, consommateur_prm, consommateur_rang, date_signature_consommateur, statut')
      .eq('producteur_id', producteur_id)
      .in('statut', ['attente_délai_légal', 'attente_mes', 'en_cours']);

    if (contratsError) {
      throw new Error('Erreur lors de la récupération des contrats : ' + contratsError.message);
    }

    if (!contrats || contrats.length === 0) {
      console.log('⚠️ Aucun contrat éligible trouvé pour ce producteur.');
      return { success: true, insertedCount: 0 };
    }

    console.log(`📋 ${contrats.length} contrats trouvés pour le producteur ${producteur_id}`);

    // 3️⃣ Préparation des enregistrements à insérer
    const records = contrats.map((c) => ({
      operation_id,
      numero_acc,
      date_demande_entree: c.date_signature_consommateur,
      date_entree: start_date,
      producteur_id,
      consommateur_prm: c.consommateur_prm,
      installation_prm: c.installation_prm,
      consommateur_id: c.consommateur_id,
      consommateur_rang: c.consommateur_rang,
    }));

    // 4️⃣ Insertion en base dans operation_prms
    const { error: insertError } = await supabase
      .from('operation_prms')
      .insert(records);

    if (insertError) {
      throw new Error('Erreur lors de l’insertion dans operation_prms : ' + insertError.message);
    }

    console.log(`✅ ${records.length} PRM insérés dans operation_prms.`);
    return { success: true, insertedCount: records.length };

  } catch (error) {
    console.error('❌ Erreur dans operationPrm :', error);
    return { success: false, error: error.message };
  }
};
