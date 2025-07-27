import supabase from '../../lib/supabaseClient.js';

/**
 * Récupère l'ID auth et le rôle (consommateur ou producteur) d'un utilisateur en fonction de son ID métier
 * @param {string} id - ID d'une des tables métiers (consommateurs.id ou producteurs.id)
 * @returns {Promise<{ user_id: string, role: string } | null>}
 */
export async function getUserInfo(id) {
  const { data: cons } = await supabase
    .from('consommateurs')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (cons) return { user_id: cons.user_id, role: 'consommateur' };

  const { data: prod } = await supabase
    .from('producteurs')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (prod) return { user_id: prod.user_id, role: 'producteur' };

  return null;
}
