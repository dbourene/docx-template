// services/sendEmail.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'TonNom <onboarding@resend.dev>', // À personnaliser avec un domaine vérifié plus tard
      to,
      subject,
      html,
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
