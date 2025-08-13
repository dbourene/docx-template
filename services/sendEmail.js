// services/sendEmail.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
import { htmlToText } from 'html-to-text';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envoie un email via Resend avec HTML et version texte générée automatiquement
 * @param {Object} params
 * @param {string} params.to - Destinataire
 * @param {string} params.subject - Sujet
 * @param {string} params.html - Contenu HTML
 * @param {Array} [params.attachments] - Pièces jointes
 */

export async function sendEmail({ to, subject, html, attachments }) {
  try {
    // Génération automatique du texte brut si HTML fourni
    const text = html
    ? htmlToText(html, {
        wordwrap: 130,
        selectors: [
          { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
        ]
      })
    : undefined; 
    
    const { data, error } = await resend.emails.send({
      from: 'Kinjo <onboarding@resend.dev>', // À personnaliser avec un domaine vérifié plus tard
      to,
      subject,
      html,
      text,
      attachments,
    });

    if (error) {
      console.error('Erreur envoi email:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Erreur générale dans sendEmail:', err);
    throw err;
  }
}
