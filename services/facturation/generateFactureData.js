// services/facturation/generateFactureData.js

import supabase from '../../lib/supabaseClient.js';

/**
 * Génère les données de facturation pour le template DOCX
 * @param {string} consommateur_prm - PRM du consommateur
 * @param {string} producteur_prm - PRM du producteur
 * @param {string} numeroFacture - numéro séquentiel de la facture
 * @param {string} operationId - UUID de l'opération
 * @param {string} startDate - date de début au format YYYYMMDDTHHMMSSZ
 * @param {string} endDate - date de fin au format YYYYMMDDTHHMMSSZ
 */
export async function generateFactureData(consommateur_prm, producteur_prm, numeroFacture, operationId, startDate, endDate) {
  console.log('📑 Génération des données de facture...');

  // -------------------------------
  // 1️⃣ Récupérer les données liées au consommateur
  // -------------------------------
  const { data: consommateur, error: consommateurError } = await supabase
    .from('consommateurs')
    .select('*')
    .eq('prm', consommateur_prm)
    .single();

  if (consommateurError || !consommateur) {
    throw new Error(`Erreur récupération consommateur: ${consommateurError?.message}`);
  }
  console.log('Consommateur trouvé:', consommateur);

  // -------------------------------
  // 2️⃣ Récupérer les données liées au producteur
  // -------------------------------
  // 🔍 Récupération de l’installation à partir du prm producteur
  const { data: installationData, error: installationDataError } = await supabase
    .from('installations')
    .select('id, producteur_id')
    .eq('prm', producteur_prm)
    .single();

  if (installationDataError || !installationData) {
    throw new Error(`Erreur récupération installation: ${installationDataError?.message}`);
  }
  console.log('Installation trouvée:', installationData);

  // 🔍 Récupération du producteur lié à l’installation
  const { data: producteur, error: producteurError } = await supabase
    .from('producteurs')
    .select('*')
    .eq('id', installationData.producteur_id)
    .single();

  if (producteurError || !producteur) {
    throw new Error(`Erreur récupération producteur: ${producteurError?.message}`);
  }
  console.log('Producteur trouvé:', producteur);

  // -------------------------------
  // 3️⃣ Récupérer le contrat associé
  // -------------------------------
  const { data: contrat, error: contratError } = await supabase
    .from('contrats')
    .select('*, operations(numero_acc)')
    .eq('consommateur_id', consommateur.id)
    .single();

  if (contratError || !contrat) {
    throw new Error(`Erreur récupération contrat: ${contratError?.message}`);
  }

  const numero_acc = contrat.operations?.numero_acc;
  if (!numero_acc) {
    throw new Error('Impossible de récupérer le numero_acc via la jointure sur operations');
  }

  // -------------------------------
  // 4️⃣ Récupérer l’installation associée
  // -------------------------------
  const { data: installation, error: installationError } = await supabase
    .from('installations')
    .select('*')
    .eq('id', contrat.installation_id)
    .single();

  if (installationError || !installation) {
    throw new Error(`Erreur récupération installation: ${installationError?.message}`);
  }

  // -------------------------------
  // 5️⃣ Récupérer la période de consommation
  // -------------------------------
  const { data: definitive, error: defError } = await supabase
    .from('definitive_active_energy_cons')
    .select('*')
    .eq('operation_id', operationId)
    .eq('prm', consommateur_prm)
    .gte('start_date', startDate)
    .lte('end_date', endDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (defError || !definitive) {
    throw new Error(`Erreur récupération consommation: ${defError?.message}`);
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  };

  const start_date = formatDate(definitive.start_date);
  const end_date = formatDate(definitive.end_date);

  // -------------------------------
  // 6️⃣ Récupérer l’accise applicable
  // -------------------------------
  const { data: accise, error: acciseError } = await supabase
    .from('accises')
    .select('*')
    .lte('periode_debut', definitive.start_date)
    .gte('periode_fin', definitive.end_date)
    .single();

  if (acciseError || !accise) {
    throw new Error(`Erreur récupération accise: ${acciseError?.message}`);
  }

  // -------------------------------
  // 7️⃣ Calculs intermédiaires
  // -------------------------------
  
  // 💡 Volumes (base_autocons absent en BDD -> on le calcule)
  const base_autocons =
    (definitive.pointe_autocons || 0) +
    (definitive.HPH_autocons || 0) +
    (definitive.HCH_autocons || 0) +
    (definitive.HPB_autocons || 0) +
    (definitive.HCB_autocons || 0);

  // ✅ Total d'autoconsommation (sans double compte)
  const autocons_totale = base_autocons;

  const arr2 = (v) => (v ? Number(v).toFixed(2) : '0.00');
  const arr4 = (v) => (v ? Number(v).toFixed(4) : '0.0000');

  const base_total_ht = arr2(base_autocons * (contrat.tarif_base || 0)/100);
  const pointe_total_ht = arr2(definitive.pointe_autocons * (contrat.tarif_pointe || 0)/100);
  const hph_total_ht = arr2(definitive.HPH_autocons * (contrat.tarif_HPH || 0)/100);
  const hch_total_ht = arr2(definitive.HCH_autocons * (contrat.tarif_HCH || 0)/100);
  const hpb_total_ht = arr2(definitive.HPB_autocons * (contrat.tarif_HPB || 0)/100);
  const hcb_total_ht = arr2(definitive.HCB_autocons * (contrat.tarif_HCB || 0)/100);

  const accise_totale_taux_inf_36kVA = arr2(autocons_totale * (accise.taux_inf_36kVA || 0)/100);
  const accise_totale_taux_36kVA_250kVA = arr2(autocons_totale * (accise.taux_36kVA_250kVA || 0)/100);
  const accise_totale_taux_sup_250kVA = arr2(autocons_totale * (accise.taux_sup_250kVA || 0)/100);
  const accise_totale_taux_reduit = arr2(autocons_totale * (accise.taux_reduit || 0)/100);

  const total_ht =
    parseFloat(base_total_ht) +
    parseFloat(pointe_total_ht) +
    parseFloat(hph_total_ht) +
    parseFloat(hch_total_ht) +
    parseFloat(hpb_total_ht) +
    parseFloat(hcb_total_ht) +
    parseFloat(accise_totale_taux_inf_36kVA) +
    parseFloat(accise_totale_taux_36kVA_250kVA) +
    parseFloat(accise_totale_taux_sup_250kVA) +
    parseFloat(accise_totale_taux_reduit);

  const total_tva = arr2(total_ht * 0.2);
  const total_ttc = arr2(total_ht + parseFloat(total_tva));

  // -------------------------------
  // 8️⃣ Construction des données template
  // -------------------------------
  const consommateurType = consommateur.siret ? 'entreprise' : 'particulier';
  const producteurType = producteur.siret ? 'entreprise' : 'particulier';

  const templateData = {
    // Flags conditionnels
    consommateur_particulier: consommateurType === 'particulier',
    consommateur_entreprise: consommateurType === 'entreprise',
    producteur_particulier: producteurType === 'particulier',
    producteur_entreprise: producteurType === 'entreprise',
    contrat_base: contrat.tarif_base != null,
    contrat_pointe: contrat.tarif_pointe != null,
    contrat_HPH: contrat.tarif_HPH != null,
    contrat_HCH: contrat.tarif_HCH != null,
    contrat_HPB: contrat.tarif_HPB != null,
    contrat_HCB: contrat.tarif_HCB != null,
    categorie_puissance_branchement_1: consommateur.categorie_puissance_branchement === 1,
    categorie_puissance_branchement_2: consommateur.categorie_puissance_branchement === 2,
    categorie_puissance_branchement_3: consommateur.categorie_puissance_branchement === 3,
    categorie_puissance_branchement_4: consommateur.categorie_puissance_branchement === 4,
    
    // Données consommateur
    consommateur_contact_prenom: consommateur.contact_prenom || '[PRENOM_ABSENT]',
    consommateur_contact_nom: consommateur.contact_nom || '[NOM_ABSENT]',
    consommateur_adresse: consommateur.adresse || '[ADRESSE_ABSENTE]',
    consommateur_prm,
    consommateur_siret: consommateur.siret || '[SIRET_ABSENT]',
    consommateur_denominationUniteLegale: consommateur.denominationUniteLegale || '[DENOMINATION_ABSENTE]',
    consommateur_contact_email: consommateur.contact_email || '[EMAIL_ABSENTE]',

    // Données producteur
    producteur_contact_prenom: producteur.contact_prenom || '[PRENOM_ABSENT]',
    producteur_contact_nom: producteur.contact_nom || '[NOM_ABSENT]',
    producteur_adresse: producteur.adresse || '[ADRESSE_ABSENTE]',
    producteur_siret: producteur.siret || '[SIRET_ABSENT]',
    producteur_denominationUniteLegale: producteur.denominationUniteLegale || '[DENOMINATION_ABSENTE]',
    producteur_sigleUniteLegale: producteur.sigleUniteLegale || '[SIGLE_ABSENT]',

    // Données installation
    installation_titulaire: installation.titulaire || '[TITULAIRE_ABSENT]',

    // Données facture
    facture_numero: numeroFacture,
    date_facture: new Date().toLocaleDateString('fr-FR'),
    date_reglement_du: (() => {
      const date = new Date();
      date.setDate(date.getDate() + 15);
      return date.toLocaleDateString('fr-FR');
    })(),

    // Données contrat
    contrat_numero: contrat.numero || '[NUMERO_CONTRAT_ABSENT]',
    tarif_base: arr4((contrat.tarif_base || 0)/100),
    tarif_pointe: arr4((contrat.tarif_pointe || 0)/100),
    tarif_HPH: arr4((contrat.tarif_HPH || 0)/100),
    tarif_HCH: arr4((contrat.tarif_HCH || 0)/100),
    tarif_HPB: arr4((contrat.tarif_HPB || 0)/100),
    tarif_HCB: arr4((contrat.tarif_HCB || 0)/100),

    // Données consommation
    start_date,
    end_date,
    base_autocons,
    pointe_autocons: definitive.pointe_autocons,
    HPH_autocons: definitive.HPH_autocons,
    HCH_autocons: definitive.HCH_autocons,
    HPB_autocons: definitive.HPB_autocons,
    HCB_autocons: definitive.HCB_autocons,

    base_total_ht,
    pointe_total_ht,
    hph_total_ht,
    hch_total_ht,
    hpb_total_ht,
    hcb_total_ht,
    autocons_totale,

    // Accises
    taux_inf_36kVA: accise.taux_inf_36kVA,
    taux_36kVA_250kVA: accise.taux_36kVA_250kVA,
    taux_sup_250kVA: accise.taux_sup_250kVA,
    taux_reduit: accise.taux_reduit,
    accise_totale_taux_inf_36kVA,
    accise_totale_taux_36kVA_250kVA,
    accise_totale_taux_sup_250kVA,
    accise_totale_taux_reduit,

    // Totaux
    total_ht: arr2(total_ht),
    total_tva,
    total_ttc,
  };
  console.log('✅ Les Flags conditionnels sont :', templateData);
  console.log('✅ Données facture générées avec succès');
  return { templateData, numero_acc };
}