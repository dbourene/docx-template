// services/repartition/processMails.js
import fs from "fs-extra";
import path from "path";
import { parseMsg } from "./parseMsg.js";
import { downloadFilesFromSupabase } from "./utils/supabaseUtils.js";

/**
 * Étape 1 du flux Enedis :
 * - Télécharge les fichiers .msg du mois donné depuis Supabase
 * - Parse chaque fichier pour identifier :
 *   type ("mot de passe" ou "courbes"), n° ACC, période, mot de passe éventuel
 */
export async function processMails(month) {
  console.log(`📬 Démarrage du traitement pour le mois ${month}...`);

  // Répertoire temporaire local
  const localMonthDir = path.resolve("temp", month);
  await fs.ensureDir(localMonthDir);

  // Téléchargement des fichiers .msg depuis Supabase
  console.log("⬇️ Téléchargement des fichiers .msg depuis Supabase...");
  const downloadedFiles = await downloadFilesFromSupabase(month, localMonthDir);
  console.log(`📁 ${downloadedFiles.length} fichier(s) .msg téléchargé(s).`);

  const results = [];

  for (const filePath of downloadedFiles) {
    try {
      const info = await parseMsg(filePath);
      results.push(info);

      console.log(
        `📨 [${info.type}] Opération ${info.operationId || "?"} – Période ${info.periode?.debut || "?"} → ${info.periode?.fin || "?"}`
      );
      if (info.motDePasse) console.log(`🔐 Mot de passe : ${info.motDePasse}`);
    } catch (err) {
      console.error(`❌ Erreur lors du parsing du fichier ${filePath}:`, err.message);
    }
  }

  return results;
}
