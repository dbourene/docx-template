// getInpiToken.js

import fetch from "node-fetch";

/**
 * Génère un token de connexion à l'API INPI
 * @param {string} username - identifiant (email utilisé pour le compte INPI)
 * @param {string} password - mot de passe associé
 * @param {boolean} preprod - true pour utiliser l'environnement de test
 * @returns {Promise<string>} - le token JWT retourné par l'API
 */
export async function getInpiToken(username, password, preprod = true) {
  const baseUrl = preprod
    ? "https://registre-national-entreprises-pprod.inpi.fr"
    : "https://registre-national-entreprises.inpi.fr";

  const url = `${baseUrl}/api/sso/login`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erreur API INPI (${response.status}) : ${errorText}`
      );
    }

    const data = await response.json();
    console.log("✅ Réponse API INPI:", data);

    // L'API renvoie normalement un objet avec { token: "..." }
    return data.token;
  } catch (err) {
    console.error("❌ Erreur lors de la récupération du token INPI:", err);
    throw err;
  }
}

// Exemple d'utilisation
const username = "dbourene@audencia.com";
const password = "INPLupin3sei#35";

getInpiToken(username, password).then((token) => {
  console.log("🔑 Token INPI:", token);
});
