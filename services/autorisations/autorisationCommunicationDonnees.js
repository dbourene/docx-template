// services/autorisations/autorisationCommunicationDonnees.js

import supabase from "../../lib/supabaseClient.js";
import { getClientIp } from "../../common/getClientIp.js";

// Service pour gérer l'autorisation de communication des données
export async function handleAutorisationCommunication(data, req) {
  const { user_id, role, donnees_mesures, donnees_index, donnees_pmax, donnees_cdc, donnees_techniques, habilitation } = data;
  const ip = getClientIp(req);
  console.log("Données reçues pour autorisation communication:", data);

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
  console.log("Insertion de l'autorisation de communication dans la base de données avec les données:", {
    user_id, role, donnees_mesures, donnees_index, donnees_pmax, donnees_cdc, donnees_techniques, habilitation, ip, prenom_nom, adresse, prm
  });
  const { data: insertAutorisation, error: errInsertAutorisation } = await supabase
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
        adresse_ip: ip,
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
