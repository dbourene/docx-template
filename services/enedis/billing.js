// services/enedis/billing.js
/**
 * Récupère les données facturantes pour la période [from, to[
 * endpointPath: ex "/vX/facturation" (tu me donneras la vraie valeur)
 * query: params additionnels (PDL, identifiants, filtres…)
 */
export async function fetchBillingData({
  apiBase,
  endpointPath,
  accessToken,
  from,
  to,
  query = {},
}) {
  const url = new URL(endpointPath, apiBase);
  const search = new URLSearchParams({ ...query, from, to });
  url.search = search.toString();

  const res = await fetch(url, {
    method: 'GET', // ou POST selon la doc ENEDIS
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Ajoute ici tout header spécifique requis par ENEDIS
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ENEDIS billing error: ${res.status} ${text}`);
  }
  return res.json();
}
