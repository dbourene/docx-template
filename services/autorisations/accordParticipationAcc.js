// services/autorisations/accordParticipationAcc.js

import supabase from "../../lib/supabaseClient.js";


// Service pour gérer l'accord de participation à l'ACC
export async function handleAccordParticipation(data) {
  const { 
    user_id,
    ip,
    role,
    collecte_cdc,
    transmission_fournisseur,
    transmission_tiers_cons,
    transmission_tiers_prod,
    accord_participation,
    prm
  } = data;

  console.log("Données reçues pour l'accord de participation à l'ACC:", data);

  // Validation des entrées
  // Récupération des infos complémentaires
  let prenom_nom, adresse;

  if (role === "consommateur") {
    const { data: consommateur, error: errCons } = await supabase
      .from("consommateurs")
      .select("id, contact_prenom, contact_nom, adresse, prm")
      .eq("user_id", user_id)
      .eq("prm", prm)
      .single();
    console.log("Consommateur trouvé:", consommateur, "data:", data);
    if (errCons) throw new Error(errCons.message);

    prenom_nom = `${consommateur.contact_prenom} ${consommateur.contact_nom}`;
    adresse = consommateur.adresse;
    
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
    console.log("Prénom Nom:", prenom_nom, "Adresse:", adresse, "PRM:", prm);

  } else {
    throw new Error("Role invalide (doit être 'consommateur' ou 'producteur')");
  }

  // Insertion dans la table accord_participation_acc
  console.log("Table cible: accord_participation_acc");
  console.log("📥 Insertion de l'accord de participation à l'ACC dans la base de données avec les données:", {
    user_id, role, collecte_cdc, transmission_fournisseur, transmission_tiers_cons, transmission_tiers_prod, accord_participation, ip, prenom_nom, adresse, prm
  });
  const { data: insertAccord, error: errInsertAccord } = await supabase
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
        adresse_ip: ip,
        prenom_nom,
        adresse,
        prm
      },
    ])
    .select()
    .single();

  if (errInsertAccord) {
    console.error("❌ Erreur insertion ACC:", errInsertAccord);
    throw new Error(errInsertAccord.message);
  }

  return {
    accord: insertAccord
  };
}