// services/contrat/determineStatutContrat.js
// Détermine le statut d'un contrat en fonction des signatures et du type de consommateur

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const determineStatutContrat = async (contratId, dateSignatureProducteurOverride = null) => {
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

  const dateSignatureCons = contrat.date_signature_consommateur
    ? new Date(contrat.date_signature_consommateur)
    : null;
  const dateSignatureProd = dateSignatureProducteurOverride
    ? new Date(dateSignatureProducteurOverride)
    : contrat.date_signature_producteur
    ? new Date(contrat.date_signature_producteur)
    : null;

  if (type === 'particulier') {
    if (!dateSignatureCons) {
      return 'panier'; // ou autre statut par défaut
    }

    const diffDays = Math.floor((now - dateSignatureCons) / (1000 * 60 * 60 * 24));

    if (!dateSignatureProd) {
      // Le producteur n'a pas signé
      return diffDays >= 14 ? 'abandon_délai_légal_expiré' : 'attente_prod_délai_légal';
    } else {
      // Le producteur a signé
      return diffDays >= 14 ? 'en_cours' : 'attente_délai_légal';
    }
  }

  if (type === 'pro') {
    return dateSignatureProd ? 'en_cours' : 'attente_prod';
  }

  throw new Error('Type de consommateur inconnu : ' + type);
};
