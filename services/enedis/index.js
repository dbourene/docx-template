// services/enedis/index.js
import fetchEnedisData from "./fetchEnedisData.js";

/**
 * Lance la récupération et l'insertion des données ENEDIS
 * @param {string} operationId - UUID de l'opération
 * @param {string} start - date de début au format YYYYMMDDTHHMMSSZ
 * @param {string} end - date de fin au format YYYYMMDDTHHMMSSZ
 */
export async function runEnedisJob(operationId, start, end) {
  try {
    console.log(`🚀 Démarrage du job ENEDIS pour opération ${operationId}...`);
    await fetchEnedisData(operationId, start, end);
    console.log(`✅ Job ENEDIS terminé pour opération ${operationId}`);
    return { success: true };
  } catch (err) {
    console.error("❌ Erreur runEnedisJob :", err.message);
    return { success: false, error: err.message };
  }
}
