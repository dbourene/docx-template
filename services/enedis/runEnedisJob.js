// services/enedis/runEnedisJob.js
import fetchEnedisData from "./fetchEnedisData.js";
import { handleGenerateFacture } from "../facturation/handleGenerateFacture.js";

/**
 * Lance la récupération et l'insertion des données ENEDIS
 * @param {string} operationId - UUID de l'opération
 * @param {string} startDate - date de début au format YYYYMMDDTHHMMSSZ
 * @param {string} endDate - date de fin au format YYYYMMDDTHHMMSSZ
 */
export async function runEnedisJob(operationId, startDate, endDate) {
  console.log(`🚀 Démarrage du job ENEDIS pour opération ${operationId}...`);
  
  let fetchResult;
  try {
    // Récupération des données ENEDIS
    fetchResult = await fetchEnedisData(operationId, startDate, endDate);

    if (!fetchResult.success) {
      throw new Error("❌ Échec de récupération ENEDIS: " + fetchResult.error);
    }
  
    console.log("✅ Données ENEDIS récupérées:", fetchResult);

    return {
      success: true,
      details: fetchResult
    };  
  } catch (err) {
    console.error("❌ Erreur récupération ENEDIS:", err);
    return {
      success: false,
      error: "Récupération ENEDIS échouée: " + err.message
    };
  }
}
