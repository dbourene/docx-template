// services/dac/autorisationCommunicationService.js

import supabase from "../../lib/supabaseClient.js";

// Service pour gérer l'autorisation de communication des données
export async function handleAutorisationCommunication(data) {
  const { user_id, role, donnees_mesures, donnees_index, donnees_pmax, donnees_cdc, donnees_techniques, habilitation, adresse_IP } = data;
  console.log("Données reçues pour autorisation communication:", data);
  
  // Validation des entrées
  // Récupération des infos complémentaires
  let prenom_nom, adresse, prm;

  if (role === "consommateur") {
    const { data: consommateur, error: errCons } = await supabase
      .from("consommateurs")
      .select("contact_prenom, contact_nom, adresse, prm")
      .eq("user_id", user_id)
      .single();

    if (errCons) throw new Error(errCons.message);

    prenom_nom = `${consommateur.contact_prenom} ${consommateur.contact_nom}`;
    adresse = consommateur.adresse;
    prm = consommateur.prm;
  } else if (role === "producteur") {
    const { data: producteur, error: errProd } = await supabase
      .from("producteurs")
      .select("contact_prenom, contact_nom, adresse")
      .eq("user_id", user_id)
      .single();

    if (errProd) throw new Error(errProd.message);

    const { data: installation, error: errInst } = await supabase
      .from("installations")
      .select("prm")
      .eq("producteur_id", producteur.id)
      .limit(1)
      .single();

    if (errInst) throw new Error(errInst.message);

    prenom_nom = `${producteur.contact_prenom} ${producteur.contact_nom}`;
    adresse = producteur.adresse;
    prm = installation.prm;
  } else {
    throw new Error("Role invalide (doit être 'consommateur' ou 'producteur')");
  }

  // Insertion dans la table autorisation_communication_donnees
  const { data: insert, error: errInsert } = await supabase
    .from("autorisation_communication_donnees")
    .insert([
      {
        user_id,
        role,
        donnees_mesures,
        donnees_index,
        donnees_pmax,
        donnees_cdc,
        donnees_techniques,
        habilitation,
        adresse_ip: adresse_IP,
        prenom_nom,
        adresse,
        prm,
        date_validite: new Date(new Date().setMonth(new Date().getMonth() + 24)), // +24 mois
      },
    ])
    .select()
    .single();

  if (errInsert) throw new Error(errInsert.message);

  return insert;
}
