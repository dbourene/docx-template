import supabase from '../../lib/supabaseClient.js';

async function setAdminRole(userId) {
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role: 'admin' }
  });
  if (error) {
    console.error('Erreur mise à jour user_metadata:', error);
  } else {
    console.log('Utilisateur mis à jour:', data);
  }
}

// Remplace par l’UUID de l’utilisateur à promouvoir en admin
const userId = '3af88680-0075-40d0-a17f-583074d52a18';

setAdminRole(userId);
