// services/downloadTemplateLocally.js

// Télécharge le template DOCX depuis Supabase Storage et le sauvegarde localement

import fs from 'fs/promises';
import path from 'path';
import supabase from '../../lib/supabaseClient.js';

/**
 * Télécharge le template DOCX depuis Supabase Storage et le sauvegarde localement
 * @param {string} templateFileName - ex: 'CPV_template_V0_1.docx'
 * @returns {string} - Le chemin local absolu du fichier téléchargé
 */
export async function downloadTemplateLocally(templateFileName) {
  const localPath = path.join(process.cwd(), 'docx-templates', templateFileName);

  try {
    console.log('⬇️ Téléchargement du template depuis Supabase Storage...');
    const { data, error } = await supabase
      .storage
      .from('contrats')
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
