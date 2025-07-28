// Met à jour un contrat dans la base de données
// en définissant l'URL du PDF signé et le statut du contrat

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const updateContratInDatabase = async (contratId, { statut, url_document }) => {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('contrats')
    .update({
      url_document,
      statut,
      date_signature_consommateur: now,
    })
    .eq('id', contratId);

  if (error) throw new Error('Erreur maj contrat: ' + error.message);
};
