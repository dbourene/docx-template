// services/operations/handleIntegrationApresMiseEnService.js
// Gère l'intégration du consommateur après la mise en service de l'ACC

import { sendIntegrationRequestToEnedis } from './sendIntegrationRequestToEnedis.js'; 
import { insertOperationPrm } from '../common/insertOperationPrm.js';
import { sendEmail } from '../sendEmail.js';
import supabase from '../../lib/supabaseClient.js';

export async function handleIntegrationApresMiseEnService(contrat_id) {
  console.log(`⚙️ [Après MES] Intégration consommateur pour le contrat ${contrat_id}`);

  // 1️⃣ Récupération des infos du contrat et de l'opération
  const { data: contrat, error } = await supabase
    .from('contrats')
    .select(`
      id,
      operation_id,
      numero_acc,
      producteur_id,
      consommateur_id,
      consommateur_prm,
      installation_prm,
      consommateur_rang,
      consommateurs(contact_email, contact_prenom)
    `)
    .eq('id', contrat_id)
    .single();

  if (error) throw new Error(`Erreur récupération contrat : ${error.message}`);

  // 2️⃣ Appel à l’API Enedis (à implémenter)
  const response = await sendIntegrationRequestToEnedis(contrat);

  if (response.success) {
    // 3️⃣ Insertion dans operation_prms
    await insertOperationPrm({
      operation_id: contrat.operation_id,
      numero_acc: contrat.numero_acc,
      date_demande_entree: new Date().toISOString(),
      date_entree: null,
      producteur_id: contrat.producteur_id,
      consommateur_prm: contrat.consommateur_prm,
      installation_prm: contrat.installation_prm,
      consommateur_id: contrat.consommateur_id,
      consommateur_rang: contrat.consommateur_rang
    });

    // 4️⃣ Notification du consommateur
    await sendEmail({
      from: 'Helioze <onboarding@resend.dev>',
      to: [contrat.consommateurs.contact_email],
      subject: 'Votre intégration à l’opération est confirmée',
      html: `
        <p>Bonjour ${contrat.consommateurs.contact_prenom},</p>
        <p>Votre point de livraison (${contrat.consommateur_prm}) a été intégré à l’opération.</p>
        <p>Cordialement,<br>L’équipe Kinjo</p>
      `
    });

    console.log('✅ Intégration après mise en service réussie.');
  } else {
    console.error('❌ Erreur lors de la requête Enedis :', response.error);
  }
}
