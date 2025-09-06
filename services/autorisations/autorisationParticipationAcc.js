// services/autorisations/autorisationParticipationAcc.js

import supabase from "../../lib/supabaseClient.js";

// Service pour gérer l'autorisation de participation à l'ACC
export async function handleAutorisationParticipation(data) {
  const { user_id, role, collecte_cdc, transmission_fournisseur, transmission_tiers_cons, transmission_tiers_prod, accord_participation, adresse_IP } = data;
  console.log("Données reçues pour autorisation participation à l'ACC:", data);

  // Validation des entrées
  // Récupération des infos complémentaires
  let prenom_nom, adresse, prm;

  if (role === "consommateur") {
    const { data: consommateur, error: errCons } = await supabase
      .from("consommateurs")
      .select("id, contact_prenom, contact_nom, adresse, prm")
      .eq("user_id", user_id)
      .single();
    console.log("Consommateur trouvé:", consommateur, "data:", data);
    if (errCons) throw new Error(errCons.message);

    prenom_nom = `${consommateur.contact_prenom} ${consommateur.contact_nom}`;
    adresse = consommateur.adresse;
    prm = consommateur.prm;
  } else if (role === "producteur") {
    const { data: producteur, error: errProd } = await supabase
      .from("producteurs")
      .select("id, contact_prenom, contact_nom, adresse")
      .eq("user_id", user_id)
      .single();
    console.log("Producteur trouvé:", producteur, "data:", data);
    if (errProd) throw new Error(errProd.message);

    const { data: installation, error: errInst } = await supabase
      .from("installations")
      .select("prm")
      .eq("producteur_id", producteur.id)
      .limit(1)
      .single();
    console.log("Installation trouvée prm:", installation);
    if (errInst) throw new Error(errInst.message);

    prenom_nom = `${producteur.contact_prenom} ${producteur.contact_nom}`;
    adresse = producteur.adresse;
    prm = installation.prm;
    console.log("Prénom Nom:", prenom_nom, "Adresse:", adresse, "PRM:", prm);

  } else {
    throw new Error("Role invalide (doit être 'consommateur' ou 'producteur')");
  }

  // Insertion dans la table autorisation_communication_donnees
  console.log("Insertion de l'autorisation de participation à l'ACC dans la base de données avec les données:", { user_id, role, collecte_cdc, transmission_fournisseur, transmission_tiers_cons, transmission_tiers_prod, accord_participation, adresse_IP, prenom_nom, adresse, prm });
  const { data: insertAutorisation, error: errInsertAutorisation } = await supabase
    .from("accord_participation_acc")
    .insert([
      {
        user_id,
        role,
        collecte_cdc,
        transmission_fournisseur,
        transmission_tiers_cons,
        transmission_tiers_prod,
        accord_participation,
        adresse_ip: adresse_IP,
        prenom_nom,
        adresse,
        prm,
        date_fin_validite: new Date(new Date().setMonth(new Date().getMonth() + 24)), // +24 mois
      },
    ])
    .select()
    .single();

  if (errInsertAutorisation) throw new Error(errInsertAutorisation.message);

  return {
    autorisation: insertAutorisation
  };
}