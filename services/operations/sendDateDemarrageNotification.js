// services/operations/sendDateDemarrageNotification.js
import supabase from '../../lib/supabaseClient.js';
import {sendEmail} from '../sendEmail.js';

/**
 * Envoie une notification "Confirmation date de mise en service"
 * au producteur et au consommateur d'une opération donnée.
 * @param {string} operationId - ID de l'opération
 */
export async function sendDateDemarrageNotification(operationId) {
  try {
    // 1. Récupération des informations du producteur et des consommateurs de l'opération dans Supabase
    const { data: operation, error} = await supabase
      .from('operations')
      .select(`
        id,
        numero_acc,
        start_date,
        producteurs (
          id,
          contact_email,
          contact_prenom,
          contact_nom
        ),
        contrats (
          consommateurs (
            id,
            contact_email,
            contact_prenom,
            contact_nom
          )
        )
      `)
      .eq('id', operationId)
      .single();

    if (error) {
      console.error('Erreur récupération opération :', error);
      throw new Error(`Opération introuvable : ${error.message}`);
    }

    // 2. Vérification des champs obligatoires

    if (!operation.numero_acc || !operation.start_date) {
      console.warn(`⚠️ Champs obligatoires numéro d'ACC (numero_acc)  et date de démarrage (start_date) manquants pour l'opération ${operationId}`);
      return { success: false, error: `Champs obligatoires manquants pour l'opération ${operationId}` };
    }
    if (!operation.producteurs) {
      console.warn(`Aucun producteur trouvé pour l'opération ${operationId}`);
      return { success: false, error: `Aucun producteur trouvé pour l'opération ${operationId}` };
    }
    
    // 3. Préparation des infos du producteur
    const producteur = operation.producteurs;
    const producteurEmail = producteur.contact_email;
    const producteurPrenom = producteur.contact_prenom || '';

    // 4. Préparation des infos du ou des consommateur(s)
    const consommateurs = (operation.contrats || [])
      .map(c => c.consommateurs)
      .filter(Boolean);

    console.log(`Producteur : ${producteurPrenom} ${producteur.contact_nom}`);
    console.log(`🔍 ${consommateurs.length} consommateurs trouvés pour l'opération ${operationId}`);

    // 5. Envoi du mail Producteur
    console.log(`📧 Envoi notification au producteur ${producteurEmail} pour l'opération ${operationId}`);
    if (!producteurEmail) {
      console.warn(`⚠️ Email du producteur manquant pour l'opération ${operationId}`);
      return { success: false, error: `Email du producteur manquant pour l'opération ${operationId}` };
    } else {
      await sendEmail({
        to: 'dbourene@audencia.com', // temporairement puis remplacer par producteurInfo.email,
        subject: `Confirmation date de mise en service - ACC ${numeroAcc}`,
        html: `
          <p>Bonjour ${producteurInfo?.name || ''},</p>
          <p>La date de mise en service pour l'ACC <strong>${numeroAcc}</strong> a été confirmée.</p>
          <p>Date de démarrage : <strong>${startDate}</strong></p>
          <p>Cordialement,<br>L'équipe Kinjo</p>
        `
      });
    }

    // 6. Délai configurables avant envoi aux consommateurs pour respecter la limite d'envoi
    const delayAfterProducer = 1000; // 1s
    const delayBetweenConsumers = 800; // 0.8s

    // 7. Pause avant envoi aux consommateurs
    await new Promise(resolve => setTimeout(resolve, delayAfterProducer));

    // 8. Envoi des notifications aux consommateurs avec délai entre chaque envoi
    for (const consommateur of consommateurs) {
      console.log(`📧 Envoi notification au consommateur ${consommateur.contact_email} pour l'opération ${operationId}`);
      if (!consommateur?.contact_email) continue;
      await sendEmail({
        to: 'dbourene@audencia.com', // temporairement puis remplacer par consommateur.contact_email,
        subject: `Confirmation de date de mise en service - ACC ${numeroAcc}`,
        html: `
          <p>Bonjour ${consommateur.contact_prenom || ''},</p>
          <p>La date de mise en service pour l'ACC <strong>${numeroAcc}</strong> a été confirmée.</p>
          <p>Date de démarrage : <strong>${startDate}</strong></p>
          <p>Cordialement,<br>L'équipe Kinjo</p>
        `
      });
      await new Promise(resolve => setTimeout(resolve, delayBetweenConsumers));
    }

    // 9. Log de succès
    console.log(`✅ Notifications de date de démarrage envoyées pour l'opération ${operationId}`);

    return { success: true };
  } catch (error) {
    console.error('Erreur envoi notification date démarrage :', error);
    return { success: false, error: error.message };
  }
}
