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

    // 🧠 Étape 1 : Dictionnaire pour stocker les mots de passe par opération
    // Clé : nom du fichier, Valeur : mot de passe
    const passwordMap = {};

    // 🧾 Suivi du traitement
    let nbPasswords = 0;
    let nbZipsExtracted = 0;
    let nbZipsMissing = 0;

    for (const file of files) {
      const filePath = path.join(monthDir, file);
      console.log(`🔍 Traitement du fichier : ${file}`);

      try {
        const parsed = await parseMsg(filePath);
        console.log(`✅ Mail analysé:`, parsed);

        // --- Si le mail contient un mot de passe, on le stocke ---
        if (parsed.type === "motdepasse" && parsed.operationId && parsed.motDePasse) {
          passwordMap[parsed.operationId] = parsed.motDePasse;
          nbPasswords++;
          console.log(`🔑 Mot de passe enregistré pour ${parsed.operationId}`);
        }
        
        // --- Si c'est un mail de données et qu'il contient un zip ---
        if (parsed.type === "donnees" && parsed.zipName) {
          const zipPath = path.join(monthDir, parsed.zipName);
          console.log(`📦 Zip attendu : ${zipPath}`);

        // 🧠 Étape 2 : récupérer le mot de passe (depuis le mail ou le cache)
          const motDePasse = parsed.motDePasse || passwordMap[parsed.operationId] || null;
          console.log(`🔐 Mot de passe utilisé pour ${parsed.zipName}:`, motDePasse ? "[masqué]" : "aucun");

          if (fs.existsSync(zipPath)) {
            console.log(`📦 Extraction du zip vers le dossier temporaire : ${tempDir}`);

            // 💥 Supprimer le ZIP précédent s’il existe dans le dossier temp
            try {
              const oldExportPath = path.join(tempDir, "export.zip");
              if (fs.existsSync(oldExportPath)) {
                fs.unlinkSync(oldExportPath);
                console.log("🧹 Ancien export.zip supprimé du dossier temporaire.");
              }
            } catch (err) {
              console.warn("⚠️ Impossible de supprimer un ancien export.zip :", err.message);
            }

            // 🧩 Extraire le zip
            await extractZip(zipPath, tempDir, motDePasse);
            nbZipsExtracted++;
            console.log(`✅ Zip extrait dans ${tempDir}`);

            // 🧹 Supprimer le zip après extraction
            try {
              if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log(`🗑️ Zip supprimé après extraction : ${zipPath}`);
              } else {
                console.warn(`⚠️ Le zip à supprimer n'existe plus : ${zipPath}`);
              }
            } catch (err) {
              console.warn(`⚠️ Impossible de supprimer le zip après extraction : ${err.message}`);
            }
            
          } else {
            console.log(`⚠️ Zip déclaré mais introuvable dans le dossier : ${zipPath}`);
            nbZipsMissing++;
          }
        }

        results.push({ file, parsed });
        
      } catch (err) {
        console.error(`❌ Erreur lors du traitement du mail ${file}:`, err.message);
        results.push({ file, error: err.message });
      }
    }

    // 🧾 Rapport final
    console.log(`🎉 Traitement terminé pour ${month}. Résumé :`);
    console.log("\n📊 --- RÉCAPITULATIF DU TRAITEMENT ---");
    console.log(`📧 Mails analysés : ${files.length}`);
    console.log(`🔑 Mots de passe détectés : ${nbPasswords}`);
    console.log(`📦 Zips extraits : ${nbZipsExtracted}`);
    console.log(`⚠️ Zips manquants : ${nbZipsMissing}`);
    console.log(`📁 Temp dir : ${tempDir}`);
    console.log("------------------------------------\n");
    return results;

  } catch (err) {
    console.error("❌ Erreur dans processMails:", err);
    throw err;
  }
}
