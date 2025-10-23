// services/contrat/determineStatutContrat.js
// Détermine le statut d'un contrat en fonction :
// - des signatures (consommateur / producteur)
// - du type de consommateur (pro / particulier)
// - du renoncement au droit de rétractation
// - de l'état d'une éventuelle opération d'ACC associée au producteur

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const determineStatutContrat = async (contratId, dateSignatureProducteurOverride = null) => {
  
  // Étape 1 : récupérer le contrat
  const { data: contrat, error: errContrat } = await supabase
    .from('contrats')
    .select('id, consommateur_id, producteur_id, date_signature_consommateur, date_signature_producteur')
    .eq('id', contratId)
    .single();

  if (errContrat || !contrat) {
    throw new Error('Erreur récupération contrat : ' + errContrat?.message);
  }

  // Étape 2 : récupérer le type de consommateur
  const { data: consommateur, error: errCons } = await supabase
    .from('consommateurs')
    .select('id, type, user_id')
    .eq('id', contrat.consommateur_id)
    .single();

  if (errCons || !consommateur) {
    throw new Error('Erreur récupération consommateur : ' + errCons?.message);
  }

  const type = consommateur.type; // "pro" ou "particulier"
  
  // Étape 3 : Récupération du renoncement droit de rétractation
  const { data: renoncementData, error: errRenon } = await supabase
    .from('renoncements_droit_retractation')
    .select('renoncement_retractation')
    .eq('user_id', consommateur.user_id)
    .maybeSingle();

  if (errRenon) {
    throw new Error('Erreur récupération renoncement : ' + errRenon?.message);
  }

  const renoncement = renoncementData ?.renoncement_retractation === true;

  // Étape 4 : Récupération éventuelle d'une opération ACC
  const { data: operation, error: errOp } = await supabase
    .from('operations')
    .select('statut')
    .eq('producteur_id', contrat.producteur_id)
    .maybeSingle();

  if (errOp) {
    throw new Error('Erreur récupération opération : ' + errOp?.message);
  }

  const operationStatut = operation?.statut ?? null; // peut être null ou int2 (1–8)
  
  // Étape 5 : Détermination du statut
  const now = new Date();
  const dateSignatureCons = contrat.date_signature_consommateur
    ? new Date(contrat.date_signature_consommateur)
    : null;
  const dateSignatureProd = dateSignatureProducteurOverride
    ? new Date(dateSignatureProducteurOverride)
    : contrat.date_signature_producteur
    ? new Date(contrat.date_signature_producteur)
    : null;

  const diffDays = dateSignatureCons
    ? Math.floor((now - dateSignatureCons) / (1000 * 60 * 60 * 24))
    : null;
    
  // --------------------
  // Cas 1 : Le producteur n'a pas encore signé
  // --------------------
  if (!dateSignatureProd) {
    if (type === 'particulier') {
      if (renoncement) {
        return 'attente_prod';
      } else {
        if (!dateSignatureCons) return 'panier';
        if (diffDays >= 14) return 'abandon_délai_légal_expiré';
        return 'attente_prod_délai_légal';
      }
    }

    if (type === 'pro') {
      return 'attente_prod';
    }
  }

  // --------------------
  // Cas 2 : Le producteur a signé
  // --------------------
  if (dateSignatureProd) {
    // Cas particulier : consommateur particulier
    if (type === 'particulier') {
      const delaiOk = diffDays >= 14;

      if (renoncement || (renoncement === false && delaiOk)) {
        // Si opération absente ou statut < 6
        if (!operationStatut || operationStatut < 6) return 'attente_mes';
        if (operationStatut === 6 || operationStatut === 7) return 'en_cours';
        if (operationStatut === 8) return 'résilié';
      } else if (!renoncement && diffDays < 14) {
        if (!operationStatut || operationStatut < 6) return 'attente_mes_délai_légal';
        if (operationStatut === 6 || operationStatut === 7) return 'attente_délai_légal';
        if (operationStatut === 8) return 'résilié';
      }
    }

    // Cas particulier : consommateur pro
    if (type === 'pro') {
      if (!operationStatut || operationStatut < 6) return 'attente_mes';
      if (operationStatut === 6 || operationStatut === 7) return 'en_cours';
      if (operationStatut === 8) return 'résilié';
    }
  }

  // --------------------
  // Cas par défaut
  // --------------------
  return 'inconnu';
};