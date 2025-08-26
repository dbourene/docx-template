// services/facturation/notifyConsommateur.js

import supabase from '../../lib/supabaseClient.js';
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
  facture_url,
  email_consommateur,
  producteur_prm,
}) {
  try {
    console.log(`📧 Notification du consommateur pour la facture ${numero}...`);

    // 1️⃣ Construire l'email
    const subject = `Votre facture ${numero} est disponible`;
    const html = `
      <p>Bonjour,</p>
      <p>Votre facture <strong>${numero}</strong> liée au producteur PRM <strong>${producteur_prm}</strong> est disponible.</p>
      <p>Vous pouvez la télécharger via le lien suivant :</p>
      <p><a href="${facture_url}">📄 Télécharger ma facture</a></p>
      <p>Cordialement,<br>L'équipe Helioze</p>
    `;

    await sendEmail({
      from: 'facturation@helioze.fr',
      to: email_consommateur,
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
