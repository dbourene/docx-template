// services/contrat/determineRangConsommateur.js
// Détermine le rang du consommateur pour un producteur donné et met à jour le contrat

import supabase from '../../lib/supabaseClient.js';

export const determineRangConsommateur = async (producteur_id, contrat_id) => {
  // 1️⃣ Compter le nombre de contrats existants pour ce producteur
  const { data: existingContracts, error } = await supabase
    .from('contrats')
    .select('id')
    .eq('producteur_id', producteur_id);
    console.log(`🔢 Nombre de contrats existants pour le producteur ${producteur_id} :`, existingContracts?.length || 0);

  if (error) throw new Error('Erreur lors du comptage des contrats : ' + error.message);

  // 2️⃣ Calcul du rang
  const rang = (existingContracts?.length || 0);

  // 3️⃣ Mise à jour du contrat courant
  const { error: updateError } = await supabase
    .from('contrats')
    .update({ consommateur_rang: rang })
    .eq('id', contrat_id);

  if (updateError) throw new Error('Erreur lors de la mise à jour du rang consommateur : ' + updateError.message);

  console.log(`🏁 Rang consommateur pour le producteur ${producteur_id} = ${rang}`);
  return rang;
};
