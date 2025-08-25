// services/downloadTemplateLocally.js

// Télécharge le template DOCX depuis Supabase Storage et le sauvegarde localement

import fs from 'fs/promises';
import path from 'path';
import supabase from '../../lib/supabaseClient.js';

/**
 * Télécharge le template DOCX depuis Supabase Storage (dans le répertoire "template")
 * et le sauvegarde localement
 * @param {string} templateFileName - ex: 'CPV_template_V0_1.docx'
 * @param {string} bucket - Nom du bucket où se trouve le répertoire "template"
 * @returns {Promise<string>} - Le chemin local absolu du fichier téléchargé
 */
export async function downloadTemplateLocally(templateFileName, bucket) {
  const localPath = path.join(process.cwd(), 'docx-templates', templateFileName);

  try {
    console.log('⬇️ Téléchargement du template depuis le bucket "', bucket, '"');
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .download(`template/${templateFileName}`);

    console.log('🧪 Résultat Supabase:', { data, error });

    if (error || !data) {
    const message = error?.message || 'Réponse vide ou invalide';
    throw new Error(`Erreur téléchargement template depuis Supabase: ${message}`);
    }

    const buffer = await data.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));
    console.log('✅ Template sauvegardé localement:', localPath);
    return localPath;

  } catch (error) {
    console.error('❌ Erreur lors du téléchargement ou sauvegarde locale du template:', error);
    throw error;
  }
}
