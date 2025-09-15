// services/contrat/updateContratInDatabase.js
// Met à jour un contrat dans la base de données
// en définissant l'URL du PDF signé et le statut du contrat

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const updateContratInDatabase = async (contratId, { statut, url_document, consommateur_IP }) => {
  const now = new Date().toISOString();

  console.log('🔄 Mise à jour du contrat', {
    contratId,
    statut,
    url_document,
    consommateur_IP,
    date_signature_consommateur: now,
  });

  // Mise à jour du contrat dans la base de données
  const { error } = await supabase
    .from('contrats')
    .update({
      url_document,
      statut,
      date_signature_consommateur: now,
      consommateur_IP
    })
    .eq('id', contratId);

    if (error) {
    console.error('❌ Erreur lors de la mise à jour du contrat :', {
      message: error.message,
      details: error.details,
      contratId,
      statut,
      url_document,
      consommateur_IP,
    });
    throw new Error('Erreur maj contrat: ' + error.message);
  }
};
