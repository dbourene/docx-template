// services/repartition/extractZip.js
import { spawn } from "child_process";
import fs from "fs";

/**
 * Décompresse un fichier ZIP dans le dossier de sortie en utilisant 7-Zip
 * @param {string} zipFilePath - Chemin du fichier ZIP
 * @param {string} outputFolder - Dossier de destination
 * @param {string} password - Mot de passe pour extraire le ZIP (facultatif)
 */
export async function extractZip(zipFilePath, outputFolder, password = "") {
  return new Promise((resolve, reject) => {
    console.log("📦 Tentative de décompression du ZIP :", zipFilePath);

    if (!fs.existsSync(zipFilePath)) {
      return reject(new Error("❌ Fichier ZIP introuvable : " + zipFilePath));
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Construction des arguments pour 7z
    const args = ["x", zipFilePath, `-o${outputFolder}`, "-y"];
    
    if (password) {
      args.push(`-p${password}`);
      console.log("🔑 Utilisation du mot de passe pour extraire le ZIP");
    }

    console.log("📌 Commande 7-Zip :", "7z", args.join(" "));

    const unZip = spawn("7z", args, { stdio: "inherit" });

    unZip.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Extraction terminée : ${outputFolder}`);
        resolve(true);
      } else {
        reject(new Error(`❌ Erreur lors de l'extraction ZIP, code ${code}`));
      }
    });

    unZip.on("error", (err) => {
      console.error("❌ Erreur lors de l'extraction ZIP :", err);
      reject(err);
    });
  });
}
