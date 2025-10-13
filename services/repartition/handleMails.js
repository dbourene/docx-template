// services/repartition/handleMails.js
import fs from "fs";
import path from "path";
import { parseMsg } from "./parseMsg.js";
import { extractZip } from "../common/extractZip.js"; // importer la fonction

/**
 * Traite les mails Enedis pour un mois donné (ex: "09_2025")
 * Les fichiers .msg doivent être présents dans le dossier NOVA/<mois>
 */
export async function handleMails(month) {
  try {
    const baseDir = path.join(process.cwd(), "NOVA"); // dossier racine local
    const monthDir = path.join(baseDir, month);
    const tempDir = path.join(process.cwd(), "temp", month);
    console.log(`📁 Dossier du mois: ${monthDir}`);
    console.log(`📁 Dossier temporaire: ${tempDir}`);
    console.log(`🔄 Début du traitement pour ${month}...`);

    if (!fs.existsSync(monthDir)) {
      throw new Error(`Le dossier ${monthDir} n'existe pas`);
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const files = fs.readdirSync(monthDir).filter((f) => f.endsWith(".msg"));

    if (files.length === 0) {
      console.log(`📭 Aucun mail trouvé dans ${monthDir}`);
      return [];
    }

    console.log(`📂 ${files.length} mail(s) trouvé(s) dans ${monthDir}`);

    const results = [];

    for (const file of files) {
      const filePath = path.join(monthDir, file);
      console.log(`🔍 Traitement du fichier : ${file}`);

      try {
        const parsed = await parseMsg(filePath);
        console.log(`✅ Mail analysé:`, parsed);

        // --- Si c'est un mail de données et qu'il contient un zip ---
        if (parsed.type === "donnees" && parsed.zipName) {
          const zipPath = path.join(monthDir, parsed.zipName);
          console.log(`📦 Zip attendu : ${zipPath}`);

          if (fs.existsSync(zipPath)) {
            console.log(`📦 Extraction du zip vers le dossier temporaire : ${tempDir}`);
            await extractZip(zipPath, tempDir, parsed.motDePasse);
            console.log(`✅ Zip extrait dans ${tempDir}`);
          } else {
            console.log(`⚠️ Zip déclaré mais introuvable dans le dossier : ${zipPath}`);
          }
        }

        results.push({ file, parsed });

      } catch (err) {
        console.error(`❌ Erreur sur ${file}:`, err.message);
        results.push({ file, error: err.message });
      }
    }

    console.log(`✅ Traitement terminé pour ${month}`);
    return results;
    
  } catch (err) {
    console.error("❌ Erreur dans processMails:", err);
    throw err;
  }
}
