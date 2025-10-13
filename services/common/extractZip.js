// services/repartition/extractZip.js
// Nécessite l'installation de "node-stream-zip"
// npm install node-stream-zip
import StreamZip from "node-stream-zip";
import fs from "fs";
import path from "path";

/**
 * Décompresse le fichier ZIP en sortie dans le dossier temp du mois
 */
export async function extractZip(zipFilePath, outputFolder) {
  return new Promise((resolve, reject) => {
    console.log("📦 Tentative de décompression du ZIP :", zipFilePath);

    if (!fs.existsSync(zipFilePath)) {
      console.error("❌ Fichier ZIP introuvable :", zipFilePath);
      return reject(new Error("ZIP introuvable"));
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const zip = new StreamZip.async({ file: zipFilePath });

    zip.entries()
      .then(async (entries) => {
        for (const entry of Object.values(entries)) {
          const entryPath = path.join(outputFolder, entry.name);
          if (entry.isDirectory) continue;
          await zip.extract(entry.name, entryPath);
          console.log(`✅ Fichier extrait : ${entryPath}`);
        }
        await zip.close();
        resolve(true);
      })
      .catch((err) => {
        console.error("❌ Erreur lors de la décompression :", err);
        reject(err);
      });
  });
}

