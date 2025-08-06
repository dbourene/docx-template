import supabase from '../../lib/supabaseClient.js';

/**
 * Récupère l'ID auth, le rôle (consommateur ou producteur) et les autres informations d'un utilisateur en fonction de son ID métier
 * @param {string} id - ID d'une des tables métiers (consommateurs.id ou producteurs.id)
 * @returns {Promise<{ user_id: string, role: string, email: string } | null>}
 */
export async function getUserInfo(id) {
  const { data: cons } = await supabase
    .from('consommateurs')
    .select('user_id, contact_email, contact_prenom, contact_nom')
    .eq('id', id)
    .maybeSingle();

  if (cons) return { 
    user_id: cons.user_id, 
    email: cons.contact_email,
    prenom: cons.contact_prenom,
    nom: cons.contact_nom,
    role: 'consommateur' 
  };
  
  const { data: prod } = await supabase
    .from('producteurs')
    .select('user_id, contact_email, contact_prenom, contact_nom')
    .eq('id', id)
    .maybeSingle();

  if (prod) return { 
    user_id: prod.user_id, 
    email: prod.contact_email,
    prenom: prod.contact_prenom,
    nom: prod.contact_nom,
    role: 'producteur'
  };

  return null;
}
