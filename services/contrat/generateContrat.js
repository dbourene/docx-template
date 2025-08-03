// Génère un contrat CPV .docx personnalisé
// à partir du template CPV_template.docx


import fs from 'fs/promises';
import path from 'path';
import { createReport } from 'docx-templates';            /* Bien conserver le nom du répertoire sous la forme docx-template et non template */
import supabase from '../../lib/supabaseClient.js';

/**
 * Génère un contrat CPV personnalisé
 * @param {string} contratId - ID du contrat dans la base
 * @param {string} consommateurId - ID du consommateur
 * @param {string} producteurId - ID du producteur
 * @param {string} installationId - ID de l'installation
 */

export async function generateContrat(contratId, consommateurId, producteurId, installationId) {
  try {
    console.log('🚀 Début génération contrat CPV...');
    console.log('📋 Paramètres:', { contratId, consommateurId, producteurId, installationId });

    // 1. Récupérer les données du consommateur
    console.log('📋 Récupération données consommateur...');
    const { data: consommateur, error: consommateurError } = await supabase
      .from('consommateurs')
      .select('*')
      .eq('id', consommateurId)
      .single();

    if (consommateurError || !consommateur) {
      throw new Error(`Erreur récupération consommateur: ${consommateurError?.message}`);
    }

    console.log('✅ Consommateur récupéré:', consommateur.contact_email);

    // 2. Récupérer les données du producteur
    console.log('🏭 Récupération données producteur...');
    const { data: producteur, error: producteurError } = await supabase
      .from('producteurs')
      .select('*')
      .eq('id', producteurId)
      .single();

    if (producteurError || !producteur) {
      throw new Error(`Erreur récupération producteur: ${producteurError?.message}`);
    }

    console.log('✅ Producteur récupéré:', producteur.contact_email);

    // 3. Récupérer les données de l'installation
    console.log('⚡ Récupération données installation...');
    const { data: installation, error: installationError } = await supabase
      .from('installations')
      .select('*')
      .eq('id', installationId)
      .single();

    if (installationError || !installation) {
      throw new Error(`Erreur récupération installation: ${installationError?.message}`);
    }

    console.log('✅ Installation récupérée:', installation.prm);

    // 4. Déterminer les types de profils
    const consommateurType = consommateur.siret ? 'entreprise' : 'particulier';
    const producteurType = producteur.siret ? 'entreprise' : 'particulier';

    console.log(`👤 Profils: Consommateur ${consommateurType}, Producteur ${producteurType}`);

    // 5. Charger le template
    console.log('📄 Chargement du template...');
    const templatePath = path.join(process.cwd(), 'docx-templates', 'CPV_template.docx');
    
    try {
      await fs.access(templatePath);
    } catch {
      throw new Error('Template CPV_template.docx non trouvé dans le dossier docx-templates/');
    }

    const template = await fs.readFile(templatePath);
    console.log('✅ Template chargé');

    // 6. Préparer les données pour le template
    const templateData = {
      // Flags pour les blocs conditionnels
      consommateur_particulier: consommateurType === 'particulier',
      consommateur_entreprise: consommateurType === 'entreprise',
      producteur_particulier: producteurType === 'particulier',
      producteur_entreprise: producteurType === 'entreprise',

      // Données consommateur
      consommateur: {
        consommateur_contact_prenom: consommateur.contact_prenom || '[PRENOM_ABSENT]',
        consommateur_contact_nom: consommateur.contact_nom || '[NOM_ABSENT]',
        consommateur_contact_email: consommateur.contact_email || '[EMAIL_ABSENT]',
        consommateur_contact_telephone: consommateur.contact_telephone || '[TEL_ABSENT]',
        consommateur_adresse: consommateur.adresse || '[ADRESSE_ABSENTE]',
        consommateur_prm: consommateur.prm || '[PRM_ABSENT]',
        consommateur_siret: consommateur.siret || '[SIRET_ABSENT]',
        consommateur_denominationUniteLegale: consommateur.denominationUniteLegale || '[DENOMINATION_ABSENTE]',
        consommateur_sigleUniteLegale: consommateur.sigleUniteLegale || '[SIGLE_ABSENT]'
      },

      // Données producteur
      producteur: {
        producteur_contact_prenom: producteur.contact_prenom || '[PRENOM_ABSENT]',
        producteur_contact_nom: producteur.contact_nom || '[NOM_ABSENT]',
        producteur_contact_email: producteur.contact_email || '[EMAIL_ABSENT]',
        producteur_contact_telephone: producteur.contact_telephone || '[TEL_ABSENT]',
        producteur_adresse: producteur.adresse || '[ADRESSE_ABSENTE]',
        producteur_siret: producteur.siret || '[SIRET_ABSENT]',
        producteur_denominationUniteLegale: producteur.denominationUniteLegale || '[DENOMINATION_ABSENTE]',
        producteur_sigleUniteLegale: producteur.sigleUniteLegale || '[SIGLE_ABSENT]'
      },

      // Données installation
      installation: {
        installation_prm: installation.prm || '[PRM_ABSENT]',
        installation_puissance: installation.puissance?.toString() || '[PUISSANCE_ABSENTE]',
        installation_tarif_base: installation.tarif_base?.toString() || '[TARIF_ABSENT]',
        installation_adresse: installation.adresse || '[ADRESSE_INSTALLATION_ABSENTE]',
        installation_titulaire: installation.titulaire || '[TITULAIRE_ABSENT]'
      },

      // Données générales
      date: new Date().toLocaleDateString('fr-FR'),
      contrat_id: contratId
    };

    console.log('📝 Données template préparées');

    // 7. Générer le document
    console.log('🔄 Génération du document...');
    const report = await createReport({    
      template,
      data: templateData,
      cmdDelimiter: ['<<', '>>'],
      /* literalXmlDelimiter: ['{{', '}}'], */
      processLineBreaks: true
    });

    console.log('✅ Document généré');

    // 8. Générer le nom du fichier
    const fileName = generateFileName(consommateur, producteur, consommateurType, producteurType);
    console.log('📝 Nom fichier:', fileName);

    // 9. Uploader vers Supabase Storage
    console.log('⬆️ Upload vers Supabase Storage...');
    const uploadPath = `consommateurs/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contrats')
      .upload(uploadPath, report, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    console.log('✅ Fichier uploadé:', uploadData);

    // 10. Mettre à jour le contrat avec l'URL
    const { data: urlData } = supabase.storage
      .from('contrats')
      .getPublicUrl(uploadPath);

    const { error: updateError } = await supabase
      .from('contrats')
      .update({ url_document: urlData.publicUrl })
      .eq('id', contratId);

    if (updateError) {
      console.warn('⚠️ Erreur mise à jour URL contrat:', updateError);
    }

    console.log('🎉 Contrat généré avec succès!');
    console.log('🔗 URL:', urlData.publicUrl);

    return {
      success: true,
      fileName, // ex. 'CPV_EntrepriseA_ConsommateurB.docx'
      url: urlData.publicUrl,
      buffer: report,  // report est déjà un Buffer depuis createReport()
      docxBuffer: report  // Alias pour compatibilité avec server.js
    };

  } catch (error) {
    console.error('❌ Erreur génération contrat:', error);
    throw error;
  }
}

/**
 * Génère le nom du fichier selon les règles métier
 */
function generateFileName(consommateur, producteur, consommateurType, producteurType) {
  // Nom producteur
  let producteurNom;
  if (producteurType === 'entreprise' && producteur.denominationUniteLegale) {
    producteurNom = producteur.denominationUniteLegale;
  } else {
    producteurNom = producteur.contact_nom || 'ProducteurInconnu';
  }
  
  // Nom consommateur
  let consommateurNom;
  if (consommateurType === 'entreprise' && consommateur.denominationUniteLegale) {
    consommateurNom = consommateur.denominationUniteLegale;
  } else {
    consommateurNom = consommateur.contact_nom || 'ConsommateurInconnu';
  }
  
  // Nettoyer les noms (supprimer caractères spéciaux)
  producteurNom = producteurNom.replace(/[^a-zA-Z0-9]/g, '_');
  consommateurNom = consommateurNom.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `CPV_${producteurNom}_${consommateurNom}.docx`;
}

// Fonction principale pour test en ligne de commande
async function main() {
  if (process.argv.length < 6) {
    console.log('Usage: node generateContrat.js <contratId> <consommateurId> <producteurId> <installationId>');
    process.exit(1);
  }

  const [, , contratId, consommateurId, producteurId, installationId] = process.argv;
  
  try {
    const result = await generateContrat(contratId, consommateurId, producteurId, installationId);
    console.log('✅ Succès:', result);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}