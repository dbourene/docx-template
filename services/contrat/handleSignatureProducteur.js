import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import signPdf from '../common/signPdf.js';
import { determineStatutContrat } from './determineStatutContrat.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handleSignatureProducteur = async (req, res) => {

  // Vérification de l'authentification
  console.log('📥 Requête reçue :', {
    body: req.body,
    headers: req.headers
  });


  try {
    const { contrat_id } = req.body;
    const user_id = req.auth?.id;

    if (!contrat_id || !user_id) {
      return res.status(400).json({ error: 'contrat_id et authentification requis' });
    }

    // 🔍 Étape 1 : Récupération du contrat
    const { data: contrat, error: contratError } = await supabase
      .from('contrats')
      .select('id, url_document, consommateur_id, date_signature_consommateur')
      .eq('id', contrat_id)
      .single();

    if (contratError || !contrat) {
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
    const pdfPathInBucket = contrat.url_document.replace(`${process.env.SUPABASE_STORAGE_BASE_URL}/contrats/finalises/`, '');
    const { data: pdfDownload, error: downloadError } = await supabase
      .storage
      .from('contrats')
      .download(`finalises/${pdfPathInBucket}`);

    if (downloadError || !pdfDownload) {
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

    const { error: uploadError } = await supabase
      .storage
      .from('contrats')
      .upload(newFilePath, fileContent, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: 'Erreur upload PDF signé producteur' });
    }

    // 🔗 URL publique
    const { data: urlData } = supabase
      .storage
      .from('contrats')
      .getPublicUrl(newFilePath);

    const publicUrl = urlData.publicUrl;

    // 🧠 Étape 7 : Calcul du nouveau statut
    const nouveauStatut = await determineStatutContrat(contrat_id);

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
      throw new Error('Erreur mise à jour contrat : ' + updateError.message);
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
