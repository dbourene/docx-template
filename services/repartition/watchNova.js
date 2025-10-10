// services/repartition/watchNova.js
import fs from "fs";
import path from "path";
import chokidar from "chokidar"; // lib pour surveiller les fichiers
import { processMails } from "./processMails.js";

/**
 * Surveille le dossier NOVA et déclenche automatiquement le traitement
 * dès qu'un nouveau mail .msg est ajouté dans un sous-dossier.
 */
export function startNovaWatcher() {
  const baseDir = path.join(process.cwd(), "NOVA");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }

  console.log(`👀 Surveillance du dossier : ${baseDir}`);

  const watcher = chokidar.watch(baseDir, {
    ignored: /(^|[\/\\])\../, // ignore fichiers cachés
    persistent: true,
    ignoreInitial: true,
    depth: 2, // surveille les sous-dossiers (ex: NOVA/09_2025)
  });

  watcher.on("add", async (filePath) => {
    if (filePath.endsWith(".msg")) {
      const parts = filePath.split(path.sep);
      const month = parts[parts.length - 2]; // ex: "09_2025"

      console.log(`📥 Nouveau mail détecté pour ${month}: ${path.basename(filePath)}`);

      try {
        await processMails(month);
        console.log(`✅ Traitement automatique terminé pour ${month}`);
      } catch (err) {
        console.error(`❌ Erreur lors du traitement auto (${month}):`, err.message);
      }
    }
  });
}
