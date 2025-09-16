// services/common/getClientIp.js
// Extrait l'adresse IP du client depuis la requête Express

export function getClientIp(req) {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      // On prend le premier IP de la chaîne
      return forwarded.split(",")[0].trim();
    }
    // Sinon fallback sur la socket
    return req.socket?.remoteAddress || null;
  } catch (err) {
    console.error("❌ Erreur extraction IP:", err);
    return null;
  }
}