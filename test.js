import { Resend } from 'resend';
import dotenv from 'dotenv';
import { htmlToText } from 'html-to-text';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);


async function testEmail() {
  await resend.emails.send({
    from: 'ENEDIS <enedis@notifications.helioze.fr>',
    to: ['cdbourene@hotmail.com'],
    replyTo: 'denis.bourene@helioze.fr',
    subject: 'Test second Resend',
    text: 'Ceci est un email test envoyé via Resend.'
  });
}

testEmail().catch(console.error);
export default testEmail;