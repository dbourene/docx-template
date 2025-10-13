// services/repartition/parseMsg.js
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
// Nécessite l'installation de "@kenjiuno/msgreader"
// npm install @kenjiuno/msgreader
// Import correct pour la version 1.27.0-alpha.3
import MsgReaderPkg from "@kenjiuno/msgreader";
const MSGReader = MsgReaderPkg.default || MsgReaderPkg;

/**
 * Analyse un mail Outlook (.msg) provenant d'Enedis
 * @param {string} filePath - Chemin du fichier local .msg
 * @returns {Promise<{type: string, operationId: string, periode: {debut: string, fin: string}, motDePasse: string|null, zipName: string, filePath: string}>}
 */
export async function parseMsg(filePath) {
  try {
    
    // Initialisation du nom du zip
    let zipName = null;

    // --- Lecture du fichier .msg ---
    const buffer = fs.readFileSync(filePath);
    const reader = new MSGReader(buffer); // Utilisation de MSGReader
    reader.getFileData(); // Nécessaire pour initialiser les données
    const msgData = reader.getFileData();

    const subject = msgData.subject || "";
    const body = msgData.body || "";
    
    // --- Extraction du numéro d'opération ---
    let operationId = null;
    // Cherche ACC suivi de 8 chiffres n'importe où
    const regexOperation = /ACC\d{8}/i;

    operationId = subject.match(regexOperation)?.[0] 
              || body.match(regexOperation)?.[0] 
              || null;

    if (!operationId) {
      console.warn(`⚠️ Impossible d'extraire le numéro d'opération dans le mail : ${filePath}`);
    }

    // --- Extraction de la période ---
    let periode = null;

    // Sujet : format _ (09_2025)
    const regexPeriodeSujet = /Période\s+du\s+[«"']?\s*(\d{1,2}_\d{1,2}_\d{4})\s*[»"']?\s*au\s+[«"']?\s*(\d{1,2}_\d{1,2}_\d{4})\s*[»"']?/i;
    // Corps : format / (01/09/2025)
    const regexPeriodeCorps = /période du\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;

    const periodeMatchSujet = subject.match(regexPeriodeSujet);
    const periodeMatchCorps = body.match(regexPeriodeCorps);

    if (periodeMatchSujet) {
      periode = { 
        debut: periodeMatchSujet[1], 
        fin: periodeMatchSujet[2], 
        key: `${periodeMatchSujet[1]}_${periodeMatchSujet[2]}`
      };
    } else if (periodeMatchCorps) {
      // remplacer / par _ pour la clé
      const debut = periodeMatchCorps[1].replace(/\//g, "_");
      const fin = periodeMatchCorps[2].replace(/\//g, "_");
      periode = { debut, fin, key: `${debut}_${fin}` };
    }

    if (!periode) {
      console.warn(`⚠️ Impossible d'extraire la période dans le mail : ${filePath}`);
    }

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

    // --- Gestion des pièces jointes ---
    // Recherche d'une pièce jointe ZIP

    if (!isMotDePasse && Array.isArray(msgData.attachments)) {
      console.log(`📎 Pièces jointes détectées dans ${path.basename(filePath)}:`);

      msgData.attachments.forEach((att, i) => {
        console.log(
          `   [${i}] Nom: ${att.fileName || "(sans nom)"}, Taille: ${
            att.fileData?.length || att.dataBuffer?.length || att.content?.length || 0
          } octets`
        );
      });

      const zipAttachment = msgData.attachments.find(
        (att) => typeof att.fileName === "string" && att.fileName.toLowerCase().endsWith(".zip")
      );

      if (zipAttachment) {
        // --- Extraction directe via Python ---
        const pythonPath = "python"; // ou chemin complet
        const scriptPath = path.join(process.cwd(), "services/repartition/extractMsgAttachments.py");
        const outDir = path.dirname(filePath);
        const args = [scriptPath, filePath, outDir];
        console.log("📌 Arguments passés à Python :", args);

        const result = spawnSync(pythonPath, args, { encoding: "utf-8" });
        console.log("📤 stdout Python :\n", result.stdout);
        console.error("📥 stderr Python :\n", result.stderr);

        // --- Vérification après extraction ---
        const extractedZipPath = path.join(outDir, zipAttachment.fileName);
        if (fs.existsSync(extractedZipPath)) {
          zipName = zipAttachment.fileName;
          console.log("✅ ZIP détecté et récupéré :", zipName);
        } else {
          console.warn(`⚠️ Impossible de récupérer le ZIP via Python : ${zipAttachment.fileName}`);
        }
      }
    }

    return {
      type,
      operationId,
      periode,
      motDePasse,
      zipName,
      filePath,
    };
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du mail ${filePath}:`, error);
    throw error;
  }
}
