import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import signPdf from '../common/signPdf.js';
import { determineStatutContrat } from './determineStatutContrat.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handleSignatureProducteur = async (req, res) => {

 // 🧾 LOGS DE DEBUG
  console.log('📩 Requête reçue pour signature producteur');
  console.log('🔍 Headers:', req.headers);
  console.log('🔍 Body:', req.body);

  const { contrat_id } = req.body;

  if (!contrat_id) {
    console.warn('⚠️ contrat_id manquant ou corps vide');
    return res.status(400).json({
      success: false,
      error: 'Requête invalide : contrat_id manquant'
    });
  }
  
  try {
  
    // Vérification de l'authentification
    console.log('📥 Requête reçue :', {
      body: req.body,
      headers: req.headers
    });
  
    const { contrat_id } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!contrat_id || !token) {
      return res.status(400).json({ error: 'contrat_id et authentification requis' });
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou utilisateur non trouvé' });
    }

    const user_id = user.id;

    // 🔍 Étape 1 : Récupération du contrat
    const { data: contrat, error: contratError } = await supabase
      .from('contrats')
      .select('id, url_document, consommateur_id, date_signature_consommateur')
      .eq('id', contrat_id)
      .single();

    if (contratError || !contrat) {
      console.error("⛔ Erreur récupération contrat :", contratError);
      return res.status(404).json({ error: 'Contrat non trouvé' });
    }

    // 🔍 Étape 2 : Vérifier que le producteur est bien lié au contrat
    const { data: producteur, error: prodError } = await supabase
      .from('producteurs')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (prodError || !producteur) {
      return res.status(403).json({ error: 'Producteur non autorisé' });
    }

    // 📥 Étape 3 : Télécharger le PDF signé par le consommateur
    const fullPath = contrat.url_document.split('/storage/v1/object/public/')[1]; 
    const bucket = 'contrats'
    const pdfPathInBucket = fullPath.startsWith(`${bucket}/`) // Vérifie si le chemin commence par le nom du bucket
      ? fullPath.slice(bucket.length + 1) // Si oui, on garde le chemin tel quel
      : fullPath; // Sinon, on enlève le nom du bucket et le slash initial

    const { data: pdfDownload, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(pdfPathInBucket);

    // Log du résultat du téléchargement
    console.log('📄 Résultat download :', {
      chemin: pdfPathInBucket,
      erreur: downloadError,
      data: pdfDownload
    });

    if (downloadError || !pdfDownload) {
      console.error("⛔ Erreur téléchargement PDF :", downloadError);
      return res.status(500).json({ error: 'Erreur lors du téléchargement du PDF' });
    }

    const pdfBuffer = await pdfDownload.arrayBuffer();
    const tempPath = `/tmp/${path.basename(pdfPathInBucket, '.pdf')}_prod.pdf`;

    // ✍️ Étape 4 : Signature du producteur
    await signPdf(Buffer.from(pdfBuffer), tempPath, {
      id: user_id,
      role: 'producteur',
      date: new Date().toISOString()
    });

    
    // 🗑️ Étape 5 : Supprimer anciens fichiers
    const prefix = pdfPathInBucket.replace('_cons.pdf', '');
    await supabase.storage.from('contrats').remove([
      `finalises/${prefix}.docx`,
      `finalises/${prefix}_cons.pdf`
    ]);

    // 📤 Étape 6 : Upload du PDF signé final
    const fileContent = await fs.readFile(tempPath);
    const newFilePath = `finalises/${prefix}_prod.pdf`;

    const uploadResult = await supabase
      .storage
      .from('contrats')
      .upload(newFilePath, fileContent, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadResult.error) {
      console.error('📛 Erreur upload Supabase :', uploadResult.error);
      return res.status(500).json({ error: 'Erreur upload PDF signé producteur' });
    }

    // 🔗 URL publique
    const { data: urlData } = supabase
      .storage
      .from('contrats')
      .getPublicUrl(newFilePath);
    
    const publicUrl = urlData.publicUrl;
    console.log('🔗 URL publique générée :', publicUrl);

    // 🧠 Étape 7 : Calcul du nouveau statut
    let nouveauStatut;
    try {
      nouveauStatut = await determineStatutContrat(contrat_id);
    } catch (err) {
      console.error("❌ Erreur lors de la détermination du statut :", err);
      return res.status(500).json({ error: 'Erreur statut contrat' });
    }

    // 📝 Étape 8 : Mise à jour du contrat
    const { error: updateError } = await supabase
      .from('contrats')
      .update({
        date_signature_producteur: new Date().toISOString(),
        statut: nouveauStatut,
        url_document: publicUrl
      })
      .eq('id', contrat_id);

    if (updateError) {
      console.error("❌ Erreur lors de la mise à jour du contrat :", updateError);
      return res.status(500).json({ error: 'Erreur update contrat' });
    }

    return res.status(200).json({
      message: 'Contrat signé par le producteur',
      url_document: publicUrl,
      statut: nouveauStatut
    });

  } catch (error) {
    console.error('❌ Erreur signature producteur :', error);
    return res.status(500).json({ error: error.message });
  }
};
