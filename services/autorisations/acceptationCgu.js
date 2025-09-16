// services/autorisations/acceptationCgu.js

import supabase from "../../lib/supabaseClient.js";
import { getClientIp } from "../../common/getClientIp.js";

// Service pour gérer l'acceptation des CGU
export async function handleAcceptationCGU(data, req) {
  const { user_id, role, validation_cgu } = data;
  const ip = getClientIp(req);
  console.log("Données reçues pour acceptation CGU:", data);

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

  // Insertion dans la table cgus
  console.log("Insertion dans cgus:", { user_id, ip, role, prenom_nom, adresse, prm, validation_cgu });

  const { data: insertCgus, error: errInsertCgus } = await supabase
    .from("cgus")
    .insert([
      {
        user_id,
        adresse_ip: ip,
        role,
        prenom_nom,
        adresse,
        prm,
        validation_cgu
      },
    ])
    .select()
    .single();

  if (errInsertCgus) throw new Error(errInsertCgus.message);

  return {
    cgu: insertCgus
  };
}
