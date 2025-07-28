// Déterminer le statut du contrat en fonction des signatures et du type de consommateur

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const determineStatutContrat = async (contratId) => {
  // Étape 1 : récupérer le contrat
  const { data: contrat, error: errContrat } = await supabase
    .from('contrats')
    .select('id, consommateur_id, date_signature_consommateur, date_signature_producteur')
    .eq('id', contratId)
    .single();

  if (errContrat || !contrat) {
    throw new Error('Erreur récupération contrat : ' + errContrat?.message);
  }

  // Étape 2 : récupérer le type de consommateur
  const { data: consommateur, error: errCons } = await supabase
    .from('consommateurs')
    .select('type')
    .eq('id', contrat.consommateur_id)
    .single();

  if (errCons || !consommateur) {
    throw new Error('Erreur récupération consommateur : ' + errCons?.message);
  }

  const type = consommateur.type; // "pro" ou "particulier"
  const now = new Date();
  const dateSignatureProd = contrat.date_signature_producteur
    ? new Date(contrat.date_signature_producteur)
    : null;

  // Cas 1 : Particulier
  if (type === 'particulier') {
    if (dateSignatureProd) {
      const diffDays = Math.floor((now - dateSignatureProd) / (1000 * 60 * 60 * 24));
      return diffDays < 14 ? 'attente_délai_légal' : 'en_cours';
    } else {
      const diffDays = Math.floor((now - now) / (1000 * 60 * 60 * 24)); // tjrs 0
      return diffDays < 14 ? 'attente_prod_délai_légal' : 'abandon_délai_légal_expiré';
    }
  }

  // Cas 2 : Professionnel
  if (type === 'pro') {
    return dateSignatureProd ? 'en_cours' : 'attente_prod';
  }

  throw new Error('Type de consommateur inconnu : ' + type);
};
