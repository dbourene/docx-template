// routers/factures.js
import express from 'express';
import supabase from '../lib/supabaseClient.js';

const router = express.Router();
const SIGNED_URL_TTL = parseInt(process.env.SIGNED_URL_TTL || '300', 10); // 5 min par défaut
const BUCKET = 'factures'; // nom du bucket

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`➡️ Demande de téléchargement pour facture id=${id}`);

  try {
    // 1) Récupérer le storage_path dans la table factures
    const { data: facture, error: fetchErr } = await supabase
      .from('factures')
      .select('id, numero, storage_path')
      .eq('id', id)
      .single();

    if (fetchErr || !facture) {
      console.error('❌ Facture introuvable', fetchErr);
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    if (!facture.storage_path) {
      console.error('❌ storage_path manquant pour la facture', facture.id);
      return res.status(500).json({ error: 'Chemin du fichier manquant pour cette facture' });
    }

    // 2) Générer l’URL signée courte durée
    const { data: signed, error: signErr } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(facture.storage_path, SIGNED_URL_TTL);

    if (signErr || !signed?.signedUrl) {
      console.error('❌ Erreur createSignedUrl', signErr);
      return res.status(500).json({ error: 'Impossible de générer un lien de téléchargement' });
    }

    console.log(`🔐 Signed URL générée pour facture ${facture.numero} (${SIGNED_URL_TTL}s)`);
    // 3) Redirection vers Supabase Storage
    return res.redirect(302, signed.signedUrl);

  } catch (err) {
    console.error('❌ Erreur route /factures/:id', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
