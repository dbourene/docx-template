// services/common/insertOperationPrm.js
// Insère une nouvelle entrée dans la table operation_prms

import supabase from '../../lib/supabaseClient.js';

export async function insertOperationPrm(fields) {
  const { data, error } = await supabase.from('operation_prms').insert([fields]);
  if (error) throw new Error(`Erreur insertion operation_prms: ${error.message}`);
  return data;
}