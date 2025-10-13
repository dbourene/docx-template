// services/common/extractZip.js
import { spawn } from "child_process";
import fs from "fs";

/**
 * Extrait un fichier ZIP avec 7-Zip (si disponible).
 * @param {string} zipFilePath - Chemin complet du fichier ZIP.
 * @param {string} outputFolder - Dossier de sortie.
 * @param {string|null} password - Mot de passe facultatif.
 */
export async function extractZip(zipFilePath, outputFolder, password = null) {
  return new Promise((resolve, reject) => {
    try {
      if (!zipFilePath || !fs.existsSync(zipFilePath)) {
        return reject(new Error(`❌ Fichier ZIP introuvable : ${zipFilePath}`));
      }

      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      // ✅ Construction d’arguments sans passer par le shell
      const args = [
        "x",
        zipFilePath,
        `-o${outputFolder}`,
        "-y",   // overwrite sans confirmation
        "-aoa", // écrase tous les fichiers existants
      ];

      if (password) {
        args.push(`-p${password}`); // pas de guillemets ici, car on n’utilise pas le shell
      }

      console.log("📦 Décompression du ZIP avec 7-Zip...");
      console.log("🔹 Chemin ZIP :", zipFilePath);
      console.log("🔹 Dossier de sortie :", outputFolder);
      console.log("🔹 Arguments :", args);

      // 🚀 Lancement de 7-Zip sans shell
      const extractProcess = spawn("7z", args, { shell: false });

      let stderrData = "";
      let stdoutData = "";

      extractProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
        if (data.toString().includes("Enter password")) {
          console.warn("⚠️ 7-Zip demande encore un mot de passe — il n’a pas été transmis !");
        }
      });

      extractProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      extractProcess.on("close", async (code) => {
        if (code === 0) {
          await new Promise((r) => setTimeout(r, 500)); // petit délai Windows
          console.log("✅ Extraction réussie avec 7-Zip");
          resolve(true);
        } else {
          console.error("❌ 7-Zip a échoué :");
          console.error("stdout:", stdoutData);
          console.error("stderr:", stderrData);
          reject(
            new Error(
              `Échec de la décompression (code ${code}) — Détails : ${stderrData}`
            )
          );
        }
      });

      extractProcess.on("error", (err) => {
        reject(new Error(`❌ Erreur lors du lancement de 7z : ${err.message}`));
      });
    } catch (err) {
      reject(new Error(`❌ Erreur inattendue dans extractZip : ${err.message}`));
    }
  });
}
