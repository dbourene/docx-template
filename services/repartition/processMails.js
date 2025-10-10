// services/repartition/processMails.js
import fs from "fs";
import path from "path";
import { parseMsg } from "./parseMsg.js";

/**
 * Traite les mails Enedis pour un mois donné (ex: "09_2025")
 * Les fichiers .msg doivent être présents dans le dossier NOVA/<mois>
 */
export async function processMails(month) {
  try {
    const baseDir = path.join(process.cwd(), "NOVA"); // dossier racine local
    const monthDir = path.join(baseDir, month);

    if (!fs.existsSync(monthDir)) {
      throw new Error(`Le dossier ${monthDir} n'existe pas`);
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

