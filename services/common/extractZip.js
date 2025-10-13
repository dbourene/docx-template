// services/repartition/extractZip.js
// Nécessite l'installation de "node-stream-zip"
// npm install node-stream-zip
import StreamZip from "node-stream-zip";
import fs from "fs";
import path from "path";

/**
 * Décompresse le fichier ZIP en sortie dans le dossier temp du mois
 * @param {string} zipFilePath - Chemin vers le fichier zip
 * @param {string} outputFolder - Dossier où extraire les fichiers
 * @param {string|null} password - Mot de passe si nécessaire
 */

export async function extractZip(zipFilePath, outputFolder, password = null) {
  return new Promise(async(resolve, reject) => {
    console.log("📦 Tentative de décompression du ZIP :", zipFilePath);

    if (!fs.existsSync(zipFilePath)) {
      console.error("❌ Fichier ZIP introuvable :", zipFilePath);
      return reject(new Error("ZIP introuvable"));
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    try {
      const zip = new StreamZip.async({
        file: zipFilePath,
        password: password || undefined, // <-- passe le mot de passe si fourni
      });

      const entries = await zip.entries();

      for (const entry of Object.values(entries)) {
        if (entry.isDirectory) continue;
        const entryPath = path.join(outputFolder, entry.name);
        await zip.extract(entry.name, entryPath);
        console.log(`✅ Fichier extrait : ${entryPath}`);
      }

      await zip.close();
      resolve(true);
    } catch (err) {
      console.error("❌ Erreur lors de la décompression :", err);
      reject(err);
    }
  });
}


