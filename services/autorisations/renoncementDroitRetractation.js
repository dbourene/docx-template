// services/autorisations/renoncementDroitRetractation.js

import supabase from "../../lib/supabaseClient.js";


// Service pour gérer le renoncement au droit de rétractation
export async function handleRenoncementDroitRetractation(data, req) {

    const { 
        user_id,
         ip,
         role,
        type,
        renoncement_retractation
    } = data;
    
    console.log("Données reçues pour renoncement au droit de rétractation:", data);

    // Validation des entrées
    // Récupération des infos complémentaires
    let prenom_nom, adresse, prm;

    if (role !== "consommateur" || type !== "particulier") {
        throw new Error("Le renoncement au droit de rétractation est réservé aux consommateurs particuliers");
    }  
        
    // ✅ Récupération du consommateur lié à l'utilisateur
    const { data: consommateur, error: errCons } = await supabase
        .from("consommateurs")
        .select("id, contact_prenom, contact_nom, adresse, prm")
        .eq("user_id", user_id)
        .single();
        
    if (errCons) throw new Error(errCons.message);
    if(!consommateur) throw new Error("Consommateur non trouvé pour cet user_id");

    console.log("Consommateur trouvé:", consommateur, "data:", data);
     
    // Calcul des informations nécessaires
    prenom_nom = `${consommateur.contact_prenom} ${consommateur.contact_nom}`;
    adresse = consommateur.adresse;
    prm = consommateur.prm;
  
    // Insertion dans la table renoncements
    console.log("Insertion dans renoncements:", { user_id, ip, role, prenom_nom, adresse, prm, renoncement_retractation });

    const { data: insertRenoncements, error: errInsertRenoncements } = await supabase
    .from("renoncement_droit_retractation")
    .insert([
        {
        user_id,
        adresse_ip: ip,
        role,
        prenom_nom,
        adresse,
        prm,
        renoncement_retractation
        },
    ])
    .select()
    .single();

    if (errInsertRenoncements) throw new Error(errInsertRenoncements.message);

    return {
    renoncement: insertRenoncements
    };
}
