// services/repartition/utils/supabaseUtils.js
import { createClient } from "@supabase/supabase-js";
import fs from "fs-extra";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Télécharge tous les fichiers .msg du dossier Supabase spécifié (ex: "09_2025")
 * @param {string} month
 * @param {string} localDir
 * @returns {Promise<string[]>} chemins locaux des fichiers téléchargés
 */
export async function downloadFilesFromSupabase(month, localDir) {
  const bucket = "mailsgrdrepartition";
  const { data, error } = await supabase.storage.from(bucket).list(month);

  if (error) throw new Error(`Erreur Supabase.list : ${error.message}`);

  const msgFiles = data.filter((f) => f.name.endsWith(".msg"));
  const localPaths = [];

  for (const file of msgFiles) {
    const { data: fileData, error: dlError } = await supabase.storage
      .from(bucket)
      .download(`${month}/${file.name}`);
    if (dlError) throw dlError;

    const localPath = path.join(localDir, file.name);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(localPath, buffer);
    localPaths.push(localPath);
  }

  return localPaths;
}
