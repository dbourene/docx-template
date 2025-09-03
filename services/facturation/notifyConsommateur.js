// services/facturation/notifyConsommateur.js

import supabase from '../../lib/supabaseClient.js';
import dotenv from 'dotenv';
import { sendEmail } from '../sendEmail.js';

/**
 * Notifie le consommateur par email qu'une nouvelle facture est disponible
 * et met à jour la colonne `date_notification` dans la table `factures`.
 * 
 * @param {Object} params
 * @param {string} params.facture_id - ID de la facture insérée
 * @param {string} params.numero - Numéro de facture (ex: FAC-PRM_001)
 * @param {string} params.facture_url - URL du PDF de facture sur Supabase Storage
 * @param {string} params.email_consommateur - Email du consommateur
 * @param {string} params.producteur_prm - PRM du producteur
 * @returns {Object} facture mise à jour
 */
export async function notifyConsommateur({
  facture_id,
  numero,
  email_consommateur,
  prm_nom,
}) {
  try {
    console.log(`📧 Notification du consommateur à l'adresse ${email_consommateur} pour mise à disposition de la facture ${numero} du producteur ${prm_nom}.`);

    // 1️⃣ Construire l'email
    console.log("🔎 BACKEND_BASE_URL =", process.env.BACKEND_BASE_URL);
    const downloadUrl = `${process.env.BACKEND_BASE_URL}/factures/${facture_id}`;
    const subject = `Votre facture ${numero} est disponible`;
    const html = `
      <p>Bonjour,</p>
      <p>Votre facture <strong>${numero} de</strong> ${prm_nom} <strong>est disponible.</p>
      <p>Vous pouvez la télécharger via le lien suivant :</p>
      <p><a href="${downloadUrl}">📄 Télécharger ma facture</a></p>
      <p>Cordialement,<br>L'équipe Helioze</p>
    `;

    await sendEmail({
      from: 'onboarding@resend.dev', // remplacer par Helioze <facturation@notifications.helioze.fr>', puis remplacer par 'Kinjo <no-reply@notifications.kinjoenergies.com>'
      to: 'dbourene@audencia.com', // remplacer par email_consommateur
      subject,
      html,
    });

    // 2️⃣ Mettre à jour la facture avec la date de notification
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('factures')
      .update({ date_notification: now })
      .eq('id', facture_id) // ⚡ à adapter si la PK de factures est différente
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Consommateur notifié, facture ${numero} mise à jour avec date_notification`);
    return data;

  } catch (error) {
    console.error('❌ Erreur lors de la notification du consommateur :', error);
    throw error;
  }
}
