// services/facturation/generateFacturesForOperation.js
import supabase from "../../lib/supabaseClient.js";
import { handleGenerateFacture } from "./handleGenerateFacture.js";

/**
 * Génère les factures pour tous les PRM liés à une opération
 * @param {string} operationId - UUID de l'opération
 * @param {string} start - date de début
 * @param {string} end - date de fin
 */
export async function generateFacturesForOperation(operationId, start, end) {
  try {
    console.log(`🧾 Début génération des factures pour opération ${operationId}`);

    // 1️⃣ Récupérer toutes les consommations définitives de l'opération
    const { data: consData, error: consError } = await supabase
      .from("definitive_active_energy_cons")
      .select("prm, start_date, end_date")
      .eq("operation_id", operationId)
      .eq("start_date", start)
      .eq("end_date", end);
    console.log("🔍 Données de Consommation récupérées dans definitive_active_energy_cons:", consData);

    if (consError) throw consError;
    if (!consData || consData.length === 0) {
      return { success: false, message: "Aucune donnée de consommation trouvée" };
    }

    console.log(`✅ ${consData.length} lignes de consommation trouvées`);

    const factures = [];

    // 2️⃣ Pour chaque PRM, retrouver le contrat correspondant
    for (const row of consData) {
      const { prm: consommateur_prm } = row;

      const { data: contrat, error: contratError } = await supabase
        .from("contrats")
        .select("id, producteur_id, consommateur_id, installation_prm, consommateur_prm")
        .eq("operation_id", operationId)
        .eq("consommateur_prm", consommateur_prm)
        .single();

      if (contratError || !contrat) {
        console.warn(`⚠️ Aucun contrat trouvé pour le PRM ${consommateur_prm}`);
        continue;
      }

      console.log(`🔗 Contrat trouvé pour consommateur ${consommateur_prm}`);

      // ⚡ Ici il faut déterminer le producteur_prm
      const producteur_prm = contrat.installation_prm; // ← si c'est bien le bon mapping

      // 3️⃣ Génération de la facture pour ce couple consommateur/producteur
      const facture = await handleGenerateFacture(
        contrat.consommateur_prm,
        producteur_prm,
        contrat.id
      );

      factures.push(facture);
    }

    return { success: true, details: factures };

  } catch (err) {
    console.error("❌ Erreur génération factures pour opération:", err.message);
    return { success: false, error: err.message };
  }
}
