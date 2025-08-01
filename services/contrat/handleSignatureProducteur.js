import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import signPdf from '../common/signPdf.js';
import { determineStatutContrat } from './determineStatutContrat.js';

console.log('📥 Entrée dans handleSignatureProducteur');

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

  // Étape 1 : Vérification de l'authentification
  try {
    console.log('🔐 Étape 1 : Vérification de l\'authentification...');
    console.log('📥 Requête reçue :', {
      body: req.body,
      headers: req.headers
    });
  
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!contrat_id || !token) {
      console.error('❌ Paramètres manquants:', { contrat_id: !!contrat_id, token: !!token });
      return res.status(400).json({ 
        success: false,
        error: 'contrat_id et authentification requis' 
      });
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('❌ Erreur authentification:', error);
      return res.status(401).json({ 
        success: false,
        error: 'Token invalide ou utilisateur non trouvé' 
      });
    }

    var user_id = user.id; // 👈 utilise `var` au lieu de `const` pour accéder à user_id en dehors du bloc
    console.log('✅ Authentification réussie pour user_id:', user_id);

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 1 (authentification):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la vérification de l\'authentification' 
    });
  }

  // Étape 2 : Récupération du contrat
  let contrat;
  try {
    console.log('🔍 Étape 2 : Récupération du contrat...');
    const { data: contratData, error: contratError } = await supabase
      .from('contrats')
      .select('id, url_document, consommateur_id, date_signature_consommateur')
      .eq('id', contrat_id)
      .single();

    if (contratError || !contratData) {
      console.error("❌ Erreur récupération contrat :", contratError);
      return res.status(404).json({ 
        success: false,
        error: 'Contrat non trouvé' 
      });
    }

    contrat = contratData;
    console.log('✅ Contrat récupéré:', contrat.id);

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 2 (récupération contrat):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération du contrat' 
    });
  }

  // Étape 3 : Vérification du producteur
  let producteur;
  
  console.log('🔍 Recherche producteur lié à user_id:', user_id);

  try {
    console.log('🏭 Étape 3 : Vérification du producteur...');
    const { data: producteurData, error: prodError } = await supabase
      .from('producteurs')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (prodError || !producteurData) {
      console.error('❌ Erreur récupération producteur:', prodError);
      return res.status(403).json({ 
        success: false,
        error: 'Producteur non autorisé' 
      });
    }

    producteur = producteurData;
    console.log('✅ Producteur vérifié:', producteur.id);

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 3 (vérification producteur):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la vérification du producteur' 
    });
  }

  // Étape 4 : Téléchargement du PDF
  let pdfBuffer, tempPath;
  try {
    console.log('📥 Étape 4 : Téléchargement du PDF...');
    const fullPath = contrat.url_document.split('/storage/v1/object/public/')[1]; 
    const bucket = 'contrats'
    const pdfPathInBucket = fullPath.startsWith(`${bucket}/`) 
      ? fullPath.slice(bucket.length + 1) 
      : fullPath;

    console.log('📄 Chemin PDF dans bucket:', pdfPathInBucket);

    const { data: pdfDownload, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(pdfPathInBucket);

    console.log('📄 Résultat download :', {
      chemin: pdfPathInBucket,
      erreur: downloadError,
      data: !!pdfDownload
    });

    if (downloadError || !pdfDownload) {
      console.error("❌ Erreur téléchargement PDF :", downloadError);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors du téléchargement du PDF' 
      });
    }

    pdfBuffer = await pdfDownload.arrayBuffer();
    tempPath = `/tmp/${path.basename(pdfPathInBucket, '.pdf')}_prod.pdf`;
    console.log('✅ PDF téléchargé, taille:', pdfBuffer.byteLength, 'bytes');

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 4 (téléchargement PDF):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors du téléchargement du PDF' 
    });
  }

  // Étape 5 : Signature du PDF
  try {
    console.log('✍️ Étape 5 : Signature du PDF...');
    await signPdf(Buffer.from(pdfBuffer), tempPath, {
      id: user_id,
      role: 'producteur',
      date: new Date().toISOString()
    });
    console.log('✅ PDF signé avec succès');

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 5 (signature PDF):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la signature du PDF' 
    });
  }

  // Étape 6 : Suppression des anciens fichiers
  try {
    console.log('🗑️ Étape 6 : Suppression des anciens fichiers...');
    const fullPath = contrat.url_document.split('/storage/v1/object/public/')[1]; 
    const bucket = 'contrats'
    const pdfPathInBucket = fullPath.startsWith(`${bucket}/`) 
      ? fullPath.slice(bucket.length + 1) 
      : fullPath;
    const prefix = pdfPathInBucket.replace('_cons.pdf', '');
    
    await supabase.storage.from('contrats').remove([
      `finalises/${prefix}.docx`,
      `finalises/${prefix}_cons.pdf`
    ]);
    console.log('✅ Anciens fichiers supprimés');

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 6 (suppression fichiers):', error);
    // Non critique, on continue
  }

  // Étape 7 : Upload du PDF signé
  let publicUrl;
  try {
    console.log('📤 Étape 7 : Upload du PDF signé...');
    const fileContent = await fs.readFile(tempPath);
    const fullPath = contrat.url_document.split('/storage/v1/object/public/')[1]; 
    const bucket = 'contrats'
    const pdfPathInBucket = fullPath.startsWith(`${bucket}/`) 
      ? fullPath.slice(bucket.length + 1) 
      : fullPath;
    const prefix = pdfPathInBucket.replace('_cons.pdf', '');
    const newFilePath = `finalises/${prefix}_prod.pdf`;

    console.log('📁 Nouveau chemin fichier:', newFilePath);

    const uploadResult = await supabase
      .storage
      .from('contrats')
      .upload(newFilePath, fileContent, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadResult.error) {
      console.error('❌ Erreur upload Supabase :', uploadResult.error);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur upload PDF signé producteur' 
      });
    }

    // Génération de l'URL publique
    const { data: urlData } = supabase
      .storage
      .from('contrats')
      .getPublicUrl(newFilePath);
    
    publicUrl = urlData.publicUrl;
    console.log('✅ Fichier signé uploadé à :', publicUrl);

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 7 (upload PDF):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'upload du PDF signé' 
    });
  }

  const now = new Date().toISOString();

  // Étape 8 : Calcul du nouveau statut
  let nouveauStatut;
  try {
    console.log('🧠 Étape 8 : Calcul du nouveau statut...');
    nouveauStatut = await determineStatutContrat(contrat_id, now);
    console.log('✅ Nouveau statut calculé:', nouveauStatut);

  } catch (error) {
    console.error("❌ Erreur dans l'étape 8 (calcul statut) :", error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la détermination du statut' 
    });
  }

  // Étape 9 : Mise à jour du contrat
  try {
    console.log('📝 Étape 9 : Mise à jour du contrat...');
    const { error: updateError } = await supabase
      .from('contrats')
      .update({
        date_signature_producteur: now,
        statut: nouveauStatut,
        url_document: publicUrl
      })
      .eq('id', contrat_id);

    if (updateError) {
      console.error("❌ Erreur lors de la mise à jour du contrat :", updateError);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la mise à jour du contrat' 
      });
    }

    console.log('✅ Contrat mis à jour en BDD pour le producteur');

    return res.status(200).json({
      success: true,
      message: 'Contrat signé par le producteur',
      url_document: publicUrl,
      statut: nouveauStatut
    });

  } catch (error) {
    console.error('❌ Erreur dans l\'étape 9 (mise à jour contrat):', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la mise à jour du contrat' 
    });
  }
};
