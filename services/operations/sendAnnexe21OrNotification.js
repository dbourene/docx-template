import supabase from '../../lib/supabaseClient.js';
import path from 'path';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { sendEmail } from '../sendEmail.js';
import { getUserInfo } from '../common/getUserInfo.js';


export async function sendAnnexe21OrNotification(contratId) {
  try {
     console.log(`[sendAnnexe21OrNotification] Début traitement pour contrat ${contratId}`);
    
     // 1. Récupération infos contrat, producteur, consommateur, installation, operation, ENEDIS
    const { data: contrat, error: contratErr } = await supabase
      .from('contrats')
      .select(`
        id,
        statut,
        created_at,
        producteur_id,
        consommateur_id,
        installation_id,
        operations(id, url_annexe21, id_acc_enedis)
      `)
      .eq('id', contratId)
      .single();
    if (contratErr) throw contratErr;
    console.log('[sendAnnexe21OrNotification] Contrat récupéré :', contrat);

    const { producteur_id, consommateur_id, statut, created_at, installation_id, operations } = contrat;

    // 2. Récupération infos producteur et consommateur
    const producteur = await getUserInfo(producteur_id);
    const consommateur = await getUserInfo(consommateur_id);

    console.log(`[sendAnnexe21OrNotification] Producteur:`, producteur);
    console.log(`[sendAnnexe21OrNotification] Consommateur:`, consommateur);

    // 3. Récupération infos installation
    console.log(`[sendAnnexe21OrNotification] Récupération infos installation pour ID: ${installation_id}`);
    const { data: installation, error: instErr } = await supabase
      .from('installations')
      .select('id, commune')
      .eq('id', installation_id)
      .single();
    console.log(`[sendAnnexe21OrNotification] Installation:`, installation);

    if (instErr) {
      console.error('[sendAnnexe21OrNotification] Erreur Supabase installations:', instErr);
    } else if (!installation) {
      console.warn('[sendAnnexe21OrNotification] ⚠️ Aucune installation trouvée pour cet ID');
    }
    console.log(`[sendAnnexe21OrNotification] Installation:`, installation);
    
    if (statut === 'attente_delai_legal') {
      const dateFinDelai = format(new Date(new Date(created_at).setDate(new Date(created_at).getDate() + 15)), 'dd/MM/yyyy');
      await sendEmail({
        to: 'dbourene@audencia.com', // temporairement puis remplacer par : producteur.email,
        subject: 'En attente de fin du délai légal de votre acheteur',
        html: `Bonjour ${producteur.prenom}, nous vous informons que le délai légal de réflexion de ${consommateur.prenom} est en cours. 
               Sans refus de sa part, le contrat sera traité à partir du ${dateFinDelai}.`
      });
      return { message: 'Notification délai légal envoyée' };
    }

    // 4. Récupération mail ENEDIS
    const { data: enedis, error: enedisErr } = await supabase
      .from('coordonnees_enedis')
      .select('mail_acc_enedis')
      .eq('id_acc_enedis', operations.id_acc_enedis)
      .single();
    if (enedisErr) throw enedisErr;
    console.log('[Annexe21] Mail ENEDIS récupéré :', enedis.mail_acc_enedis);

        
    // 5. Renommage Annexe 21 dans Supabase (optimisé avec move)
    console.log('[Annexe21] Début renommage dans Supabase...');

    const today = format(new Date(), 'yyyyMMdd');
    const oldUrl = operations.url_annexe21;
    console.log('[Annexe21] Ancienne URL :', oldUrl);

    // Exemple nom de fichier : "Xxxx_Yyyy_20240809_ANNEXE2.1.xlsx"
    const oldFileName = path.basename(oldUrl);
    const newFileName = oldFileName.replace(/\d{8}/, today);
    console.log('[Annexe21] Nouveau nom de fichier :', newFileName);

    const bucket = 'annexes21';
    const folder = 'operations'; // sous-dossier dans le bucket
    const oldPath = `${folder}/${oldFileName}`;
    const newPath = `${folder}/${newFileName}`;

    console.log(`[Annexe21] Déplacement dans bucket "${bucket}" de : ${oldPath} -> ${newPath}`);

    // Déplacement côté serveur Supabase
    const { error: moveErr } = await supabase.storage
      .from(bucket)
      .move(oldPath, newPath);

    if (moveErr) {
      console.error('[Annexe21] Erreur lors du renommage dans Supabase :', moveErr);
      throw moveErr;
    }

    console.log('[Annexe21] Renommage réussi dans Supabase.');

    // Génération de l’URL publique
    const { data: publicUrlData } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(newPath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('[Annexe21] Impossible de générer l’URL publique');
    }

    console.log('[Annexe21] Nouvelle URL publique :', publicUrlData.publicUrl);

    // Mise à jour de la table operations avec la nouvelle URL
    const { error: updOpErr } = await supabase
      .from('operations')
      .update({ url_annexe21: publicUrlData.publicUrl })
      .eq('id', operations.id);

    if (updOpErr) {
      console.error('[Annexe21] Erreur lors de la mise à jour de la table operations :', updOpErr);
      throw updOpErr;
    }

    console.log('[Annexe21] URL mise à jour dans la table operations.');

    // 6. Envoi mail ENEDIS avec PJ
    await sendEmail({
      to: 'dbourene@audencia.com', // temporairement puis remplacer par : enedis.mail_acc_enedis,
      subject: `Déclaration préalable d'ACC sur la commune de ${installation.commune}`,
      html: `Bonjour,<br><br>
        En tant que mandataire de la PMO de Kinjo, vous trouverez en PJ l’annexe 2.1 contenant l’ensemble des renseignements nécessaires à l’établissement de la convention d’ACC.<br><br>
        Je vous serais reconnaissant de me communiquer en retour, au mail en signature, un numéro d’opération d’ACC ainsi que le projet de convention.<br><br>
        Dans l’attente de votre retour je vous souhaite une agréable journée.`,
      attachments: [
        {
          filename: newFileName,
          content: fileData
        }
      ]
    });

    // 8. Envoi notifications producteur & consommateur
    await sendEmail({
      to: 'dbourene@audencia.com', // temporairement puis remplacer par : producteur.email,
      subject: 'Traitement du contrat en cours',
      html: `Bonjour ${producteur.prenom},<br><br>Nous avons le plaisir de vous informer que votre contrat est cours de traitement. 
             Une date de mise en service vous sera communiquée dans les prochains jours.`
    });
    await sendEmail({
      to: 'dbourene@audencia.com', // temporairement puis remplacer par : consommateur.email,
      subject: 'Traitement du contrat en cours',
      html: `Bonjour ${consommateur.prenom},<br><br>Nous avons le plaisir de vous informer que votre contrat est cours de traitement. 
             Une date de mise en service vous sera communiquée dans les prochains jours.`
    });

    // 9. Mise à jour tables contrats et operations
    const todayISO = new Date().toISOString();
    await supabase.from('contrats').update({ statut: 'attente_mes' }).eq('id', contratId);
    await supabase.from('operations').update({
      statut: 1,
      mail_out_annexe21: todayISO
    }).eq('id', operations.id);

    return { message: 'Mail ENEDIS et notifications envoyés avec succès' };

  } catch (err) {
    console.error('Erreur sendAnnexe21OrNotification:', err);
    throw err;
  }
}
