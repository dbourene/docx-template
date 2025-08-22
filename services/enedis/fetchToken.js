// services/enedis/fetchToken.js
import axios from "axios";
import supabase from "../../lib/supabaseClient.js";

/**
 * Récupère un token d'accès auprès d'ENEDIS pour une opération donnée
 * @param {string} operationId - UUID de l'opération (clé primaire dans `operations`)
 * @returns {Promise<string>} token Bearer ou null si erreur
 */
export async function fetchToken(operationId) {
  try {
    // 1. Récupérer les credentials pour l’opération
    const { data, error } = await supabase
      .from("operations")
      .select("client_id, client_secret")
      .eq("id", operationId)
      .single();

    if (error || !data) {
      console.error("❌ Impossible de trouver l'opération :", error);
      return null;
    }

    const { client_id, client_secret } = data;

    // 2. Préparer la requête POST vers ENEDIS
    const tokenUrl = "https://ext.prod.api.enedis.fr/oauth2/v3/token"; // URL de l'endpoint token d'ENEDIS

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id,
      client_secret,
    });

    // 3. Envoyer la requête
    const response = await axios.post(tokenUrl, body.toString(), { headers });

    if (response.status !== 200) {
      console.error("❌ Erreur lors de la récupération du token :", response.data);
      return null;
    }

    const token = response.data.access_token;
    console.log("✅ Token ENEDIS récupéré pour opération", operationId);

    return token;
  } catch (err) {
    console.error("❌ fetchToken.js - Erreur :", err.message);
    return null;
  }
}
