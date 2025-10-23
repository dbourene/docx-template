// services/contrat/handleGenerateContrat.js
// Orchestre le flux de génération d'un contrat CPV suite à l'achat par un consommateur.
// Génère le .docx, le convertit en PDF, le signe, l'upload et met à jour la BDD

import fs from 'fs';
import path from 'path';
import { generateContrat } from './generateContrat.js';
import { downloadTemplateLocally } from '../common/downloadTemplateLocally.js';
import { convertDocxToPdf } from '../common/convertDocxToPdf.js';
import signPdf from '../common/signPdf.js';
import { uploadToSupabase } from '../common/uploadToSupabase.js';
import { determineStatutContrat } from './determineStatutContrat.js';
import { updateContratInDatabase } from './updateContratInDatabase.js';
import { getUserInfo } from '../common/getUserInfo.js';
import supabase from '../../lib/supabaseClient.js';
import { sendEmail } from '../sendEmail.js';
import { updateAnnexe21AfterSignature } from '../operations/updateAnnexe21AfterSignature.js';
import { getClientIp } from '../common/getClientIp.js';
import { determineRangConsommateur } from './determineRangConsommateur.js';


export const handleGenerateContrat = async (req, res) => {
  const { contrat_id, consommateur_id, producteur_id, installation_id } = req.body;

  console.log('🚀 Début endpoint /generate');
  console.log('📋 Paramètres reçus:', req.body);

  try {
    // Étape 0 : Vérification
    if (!contrat_id || !consommateur_id || !producteur_id || !installation_id) {
      throw new Error('Tous les identifiants sont requis');
    }

    // Étape 1 : Génération du .docx
    await downloadTemplateLocally('CPV_template_V0_2.docx', 'contrats'); // Assurez-vous que le template est téléchargé
    console.log('📥 Template téléchargé localement');
    
    console.log('📄 Génération du fichier .docx...');
    const generationResult = await generateContrat(contrat_id, consommateur_id, producteur_id, installation_id);

    if (!generationResult.success || !generationResult.docxBuffer || !generationResult.fileName) {
      throw new Error('La génération du contrat a échoué');
    }

    const docxBuffer = generationResult.docxBuffer;
    const originalFileName = generationResult.fileName; // ex: 'CPV_EntrepriseA_ConsommateurB.docx'
    const tempDir = path.join('/app', 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true }); // Assure que le dossier existe

    const baseFileName = originalFileName.replace('.docx', ''); // ex: 'CPV_EntrepriseA_ConsommateurB'
    const signedPdfFileName = `${baseFileName}_cons.pdf`;  // ex: 'CPV_EntrepriseA_ConsommateurB_cons.pdf'
    
    // Note: Le nom final du PDF signé par le producteur sera géré dans la suite
    const finalPdfFileName = `${baseFileName}_cons_prod.pdf`; // Nom final du PDF signé par le producteur
    const docxPath = path.join(tempDir, originalFileName); // Chemin complet du .docx temporaire
    const signedPdfPath = path.join(tempDir, signedPdfFileName);

    console.log('📦 Buffer récupéré, taille:', docxBuffer.length, 'bytes');
    await fs.promises.writeFile(docxPath, docxBuffer);
    console.log('✅ Fichier .docx écrit:', docxPath);

    // Étape 2 : Conversion DOCX → PDF
    const pdfPath = await convertDocxToPdf(docxPath, tempDir);
    console.log('✅ PDF généré:', pdfPath);

    // Étape 3 : Lecture du PDF en buffer
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    console.log('📄 PDF lu en mémoire, taille:', pdfBuffer.length, 'octets');

    // Étape 4 : Signature
    const userInfo = await getUserInfo(consommateur_id);
    if (!userInfo || !userInfo.email || !userInfo.prenom) {
      throw new Error('Utilisateur non trouvé ou email/prénom manquant dans consommateurs ou producteurs');
    }
    
    const ip = getClientIp(req);
    console.log('🌐 Adresse IP du client:', ip);

    const signataire = {
      id: userInfo.user_id, // ← auth.users.id
      role: userInfo.role,
      date: new Date().toISOString(),
      ip: ip,
    };
    console.log('✍️ Signature du PDF...');

    await signPdf(pdfBuffer, signedPdfPath, signataire);
    console.log('✅ PDF signé:', signedPdfPath);

    // Étape 5 : Upload vers Supabase
    const supabasePath = `consommateurs/${signedPdfFileName}`; // <-- chemin relatif dans le bucket
    const bucket = 'contrats'; // <-- nom correct du bucket
    const { publicUrl, fullPath } = await uploadToSupabase(signedPdfPath, supabasePath, bucket);

    // Étape 6 : Mise à jour de la table contrats
    const statut = await determineStatutContrat(contrat_id);
    await updateContratInDatabase(contrat_id, {
      statut,
      url_document: publicUrl,
      consommateur_IP: ip,
    });

    // 🧮 Détermination du rang consommateur pour ce producteur
    try {
      console.log('🔢 Détermination du rang consommateur...');
      const rang = await determineRangConsommateur(producteur_id, contrat_id);
      console.log(`✅ Rang consommateur déterminé et mis à jour : ${rang}`);
    } catch (err) {
      console.error('⚠️ Erreur lors de la détermination du rang consommateur :', err);
    }

    // 🔄 Mise à jour du fichier annexe21 lié à l'opération
    try {
      console.log('📂 Mise à jour du fichier annexe21...');
      await updateAnnexe21AfterSignature(contrat_id);
      console.log('✅ Fichier annexe21 mis à jour avec succès.');
    } catch (err) {
      console.error('⚠️ Erreur lors de la mise à jour du fichier annexe21:', err);
    }

    // Enregistrement de l'URL publique dans la BDD
    console.log('🎉 Contrat généré et signé avec succès!');
    console.log('🔗 URL:', publicUrl);

    // Étape 7 : Réponse client
    res.status(200).json({ success: true, url: publicUrl });

    // Étape 8 : Envoi de l'email de notification
    // Récupération du prénom du producteur pour personnaliser l'email
    console.log('🔍 Récupération du prénom du producteur...');
    const { data: producteurData, error: producteurError } = await supabase
      .from('producteurs')
      .select('contact_prenom, contact_email')
      .eq('id', producteur_id)
      .single();

    if (producteurError || !producteurData) {
      throw new Error("Impossible de récupérer le prénom du producteur");
    }
    console.log('✅ Prénom du producteur récupéré:', producteurData.contact_prenom);
    
    // Création du message de notification au producteur
    console.log('📧 Envoi de l’email de notification au producteur...');
    const prenomProducteur = producteurData.contact_prenom;
    const emailProducteur = producteurData.contact_email;
    const emailSubject = `Contrat de vente d'énergie locale signé par ${userInfo.prenom || 'un consommateur'} ${userInfo.nom || ''}`; 
    const emailHtml = `<p>Bonjour ${prenomProducteur},</p>
    <p>Votre contrat de vente d'énergie locale a été signé par ${userInfo.prenom} ${userInfo.nom}.</p>
    <p>Vous pouvez le signer depuis votre espace personnel en cliquant sur "Mes consommateurs".</p>
    <p>Cordialement,</p>
    <p>L'équipe de Kinjo</p>`;
    console.log('📧 Envoi de l’email de notification...');

    await sendEmail({
      from: 'Helioze <onboarding@resend.dev>',// puis remplacer par 'Helioze <no-reply@notifications.helioze.fr>',
      to: ['dbourene@audencia.com'], // puis remplacer par emailProducteur,
      subject: emailSubject,
      html: emailHtml
    });

    // Étape 9 : Nettoyage (optionnel)
    try {
      await fs.promises.unlink(docxPath);
      await fs.promises.unlink(pdfPath);
      await fs.promises.unlink(signedPdfPath);
      console.log('🧹 Fichiers temporaires supprimés');
    } catch (cleanupErr) {
      console.warn('⚠️ Erreur nettoyage fichiers:', cleanupErr.message);
    }

  } catch (error) {
    console.error('❌ Erreur generation contrat:', error);
    // ✅ Vérification si la réponse n'a pas déjà été envoyée
    if (!res.headersSent) { 
    res.status(500).json({ success: false, message: error.message });
    }
  }
};
