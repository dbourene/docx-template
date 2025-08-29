import axios from 'axios';
import supabase from '../../lib/supabaseClient.js';
import { fetchToken } from './fetchToken.js';

/**
 * Récupère les données définitives d'énergie pour une opération donnée
 * @param {string} operationId - UUID de l'opération dans Supabase
 * @param {string} startDate - date de début au format "YYYYMMDDTHHMMSSZ"
 * @param {string} endDate - date de fin au format "YYYYMMDDTHHMMSSZ"
 */
export default async function fetchEnedisData(operationId, startDate, endDate) {
  try {
    // 1️⃣ Récupérer uniquement l’opération (numero_acc)
    const { data: operations, error: opError } = await supabase
      .from('operations')
      .select('numero_acc')
      .eq('id', operationId)
      .single();

    if (opError) throw opError;
    if (!operations) throw new Error(`Opération ${operationId} non trouvée`);

    const { numero_acc } = operations;
    console.log('Opération trouvée :', numero_acc);

    // 2️⃣ Récupérer tous les PRM liés à cette opération
    const { data: prms, error: prmError } = await supabase
      .from('operation_prms')
      .select('consommateur_prm, consommateur_id')
      .eq('operation_id', operationId);

    if (prmError) throw prmError;

    if (!prms || prms.length === 0) {
      console.log(`⚠️ Aucun PRM trouvé pour l'opération ${operationId}`);
      return { success: false, message: `Aucun PRM trouvé pour l'opération ${operationId}` };
    }
    console.log(`PRM trouvés pour l'opération ${operationId} :`, prms);

    // 3️⃣ Récupérer le token via fetchToken
    const token = await fetchToken(operationId);
    if (!token) throw new Error(`Impossible de récupérer le token pour ${operationId}`);

    // 4️⃣ Préparer un tableau d'insertions
    const inserts = [];

    for (const prmEntry of prms) {
      const { consommateur_prm } = prmEntry;

      const url = `https://gw.ext.prod.api.enedis.fr/collective_self_consumption/v4/agreements/${numero_acc}/definitive_active_energy/cons/${consommateur_prm}?start=${start}&end=${end}&type=cons,autocons,complement`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;

      const extractQuantities = (type) => {
        const distrib = data.quantities.find(
          (q) => q.type === type && q.calendar_type === 'DISTRIB'
        )?.quantities || [];

        return {
          pointe: distrib.find((q) => q.name === 'P')?.value ?? null,
          HPH: distrib.find((q) => q.name === 'HPH')?.value ?? null,
          HCH: distrib.find((q) => q.name === 'HCH')?.value ?? null,
          HPB: distrib.find((q) => q.name === 'HPB')?.value ?? null,
          HCB: distrib.find((q) => q.name === 'HCB')?.value ?? null,
        };
      };

      const autocons = extractQuantities('autocons');
      const complement = extractQuantities('complement');
      const cons = extractQuantities('cons');

      inserts.push({
        operation_id: operationId,
        prm: data.cons_id,
        start_date: data.startDate,
        end_date: data.endDate,
        unit: data.unit,
        pointe_autocons: autocons.pointe,
        HPH_autocons: autocons.HPH,
        HCH_autocons: autocons.HCH,
        HPB_autocons: autocons.HPB,
        HCB_autocons: autocons.HCB,
        pointe_complement: complement.pointe,
        HPH_complement: complement.HPH,
        HCH_complement: complement.HCH,
        HPB_complement: complement.HPB,
        HCB_complement: complement.HCB,
        pointe_cons: cons.pointe,
        HPH_cons: cons.HPH,
        HCH_cons: cons.HCH,
        HPB_cons: cons.HPB,
        HCB_cons: cons.HCB,
      });
    }

    // 5️⃣ Insérer tout en un seul batch
    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from('definitive_active_energy_cons')
        .insert(inserts);

      if (insertError) throw insertError;
      console.log(`✅ ${inserts.length} PRM insérés avec succès pour l'opération ${operationId}`);
    }

    // 6️⃣ Retourner le résultat final
    return { success: true, inserted: inserts };

  } catch (err) {
    console.error('❌ Erreur fetchEnedisData:', err.message);
    return { success: false, message: err.message };
  }
}
