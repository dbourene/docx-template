// services/operations/handleIntegrationAvantMiseEnService.js
// Gère les étapes post-signature du contrat par le producteur avant la mise en service

import { updateAnnexe21AfterSignature } from './updateAnnexe21AfterSignature.js';
import { sendAnnexe21OrNotification } from './sendAnnexe21OrNotification.js';
import { getUserInfo } from '../common/getUserInfo.js';
import { sendEmail } from '../sendEmail.js';
import supabase from '../../lib/supabaseClient.js';

export async function handleIntegrationAvantMiseEnService(contrat_id) {
  console.log(`📄 [Avant MES] Début du traitement pour le contrat ${contrat_id}`);


    try {
        // Étape 10 : Mise à jour de la dénommination du fichier annexe 21
        console.log(`📄 Lancement de la mise à jour de l'annexe 21 pour le contrat ${contrat_id}...`);
        await updateAnnexe21AfterSignature(contrat_id);
        console.log(`✅ Annexe 21 mise à jour avec succès pour le contrat ${contrat_id}`);
  
        // Étape 11 : Envoi de l'annexe 21 à ENEDIS ou de l'email de notification
        console.log(`📨 Envoi de l'annexe 21 ou notification pour le contrat ${contrat_id}...`);
        await sendAnnexe21OrNotification(contrat_id);
        console.log(`✅ Annexe 21 ou notification envoyée pour le contrat ${contrat_id}`);

        // Étape 12 : Notification du consommateur
        const { data: contratData, error } = await supabase
        .from('contrats')
        .select('consommateur_id, producteurs(contact_prenom, contact_nom)')
        .eq('id', contrat_id)
        .single();

        if (error) throw error;
        const consommateurInfo = await getUserInfo(contratData.consommateur_id);
        const producteur = contratData.producteurs;

        if (!consommateurInfo || consommateurInfo.role !== 'consommateur') {
            throw new Error("Impossible de récupérer les informations du consommateur");
        }

        // Création du message de notification au consommateur
  
        console.log('✅ Informations du consommateur récupérées:', consommateurInfo);

        const emailSubject = `Contrat de vente d'énergie locale signé par ${producteur.contact_prenom || 'un producteur'} ${producteur.contact_nom || ''}`;
        const emailHtml = `
        <p>Bonjour ${consommateurInfo.prenom},</p>
        <p>Le contrat de vente d'énergie locale a été signé par ${producteur.contact_prenom} ${producteur.contact_nom}.</p>
        <p>Il prendra effet au plus tard dans 15 jours (si vous avez refusé le délai légal de rétractation), dans 30 jours (si vous avez accepté le délai légal de rétractation).</p>
        <p>Vous serez informé prochainement par email de la date définitive d'effet du contrat.</p>
        <p>Cordialement,</p>
        <p>L'équipe de Kinjo</p>
        `;

        console.log('📧 Envoi de l’email de notification à', consommateurInfo.email);

        await sendEmail({
            from: 'Helioze <onboarding@resend.dev>',// puis remplacer par 'Helioze <no-reply@notifications.helioze.fr>',
            to: ['dbourene@audencia.com'], // puis remplacer par consommateurInfo.email,
            subject: emailSubject,
            html: emailHtml
        });
        console.log('✅ Email de notification envoyé au consommateur');
        return {success: true};

    } catch (err) {
        console.error(`❌ Erreur dans handleIntegrationAvantMiseEnService :`, err);
        throw err;
    }
}