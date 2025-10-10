// services/repartition/parseMsg.js
import fs from "fs";
import MSGReader from "msgreader"; // ✅ Import direct (pas de déstructuration)

/**
 * Analyse un mail Outlook (.msg) provenant d'Enedis
 * @param {string} filePath - Chemin du fichier local .msg
 * @returns {Promise<{type, operationId, periode, motDePasse, zipName}>}
 */
export async function parseMsg(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);

    // ✅ Instanciation correcte
    const msg = new MSGReader(buffer);
    const { subject, body } = msg.getFileData();

    // --- Extraction des éléments clés depuis le sujet du mail ---
    const regexOperation = /Convention N°(ACC\d{8,})/i;
    const regexPeriode = /Période du «\s*(\d{2}_\d{2}_\d{4})\s*» au «\s*(\d{2}_\d{2}_\d{4})\s*»/i;

    const operationMatch = subject.match(regexOperation);
    const periodeMatch = subject.match(regexPeriode);

    const operationId = operationMatch ? operationMatch[1] : null;
    const periode = periodeMatch
      ? { debut: periodeMatch[1], fin: periodeMatch[2] }
      : null;

    // --- Type de mail ---
    const isMotDePasse = subject.includes("Mot de passe");
    const type = isMotDePasse ? "motdepasse" : "donnees";

    // --- Mot de passe (dans le corps du mail) ---
    let motDePasse = null;
    if (isMotDePasse) {
      const regexPass = /mot de passe suivant\s*:\s*([A-Za-z0-9!?@#€$%^&*]+)/i;
      const match = body.match(regexPass);
      if (match) motDePasse = match[1];
    }

    console.log(`📧 Analyse du mail : ${subject}`);
    console.log(`📄 Type détecté : ${type} | Opération : ${operationId}`);

    return {
      type,
      operationId,
      periode,
      motDePasse,
      zipName: "export.zip",
      filePath,
    };
  } catch (err) {
    console.error(`❌ Erreur lors de la lecture du mail ${filePath}:`, err);
    throw err;
  }
}
