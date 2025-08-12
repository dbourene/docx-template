// services/operations/sendDateDemarrageNotification.js
import supabase from '../../lib/supabaseClient.js';
import {sendEmail} from '../sendEmail.js';
import {getUserInfo} from '../common/getUserInfo.js';

/**
 * Envoie une notification "Confirmation date de mise en service"
 * au producteur et au consommateur d'une opération donnée.
 * @param {string} operationId - ID de l'opération
 * @param {string} numeroAcc - Numéro ACC
 * @param {string} startDate - Date de démarrage
 */
export async function sendDateDemarrageNotification(operationId, numeroAcc, startDate) {
  try {
    // 1. Récupération de l'opération dans Supabase
    const { data: operation, error: opError } = await supabase
      .from('operations')
      .select('id, producteur_id, consommateur_id')
      .eq('id', operationId)
      .single();

    if (opError || !operation) {
      throw new Error(`Opération introuvable : ${opError?.message}`);
    }

    // 2. Récupération infos producteur et consommateur
    const producteurInfo = await getUserInfo(operation.producteur_id);
    const consommateurInfo = await getUserInfo(operation.consommateur_id);

    if (!producteurInfo?.email || !consommateurInfo?.email) {
      throw new Error(`Impossible de récupérer les emails du producteur ou du consommateur`);
    }

    // 3. Préparation des contenus
    const subject = `Confirmation date de mise en service - ACC ${numeroAcc}`;
    const htmlContentProducteur = `
      <p>Bonjour ${producteurInfo?.name || ''},</p>
      <p>La date de mise en service pour l'ACC <strong>${numeroAcc}</strong> a été confirmée.</p>
      <p>Date de démarrage : <strong>${startDate}</strong></p>
      <p>Cordialement,<br>L'équipe Kinjo</p>
    `;
    const textContentProducteur = `
      Bonjour ${producteurInfo?.name || ''},

      La date de mise en service pour l'ACC ${numeroAcc} a été confirmée.
      Date de démarrage : ${startDate}

      Cordialement,
      L'équipe Kinjo
    `;
    const htmlContentConsommateur = `
      <p>Bonjour ${consommateurInfo?.name || ''},</p>
      <p>La date de mise en service pour l'ACC <strong>${numeroAcc}</strong> a été confirmée.</p>
      <p>Date de démarrage : <strong>${startDate}</strong></p>
      <p>Cordialement,<br>L'équipe Kinjo</p>
    `;
    const textContentConsommateur = `
      Bonjour ${consommateurInfo?.name || ''},

      La date de mise en service pour l'ACC ${numeroAcc} a été confirmée.
      Date de démarrage : ${startDate}

      Cordialement,
      L'équipe Kinjo
    `;
     
    // 4. Envoi des emails
    await Promise.all([
      sendEmail(producteurInfo.email, subject, textContentProducteur, htmlContentProducteur),
      sendEmail(consommateurInfo.email, subject, textContentConsommateur, htmlContentConsommateur),
    ]);

    console.log(`Notification envoyée pour l'opération ${operationId}`);
    return { success: true };
  } catch (error) {
    console.error('Erreur envoi notification date démarrage :', error);
    return { success: false, error: error.message };
  }
}
