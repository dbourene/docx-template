// Envoie le PDF dans Supabase Storage

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Upload un fichier dans Supabase Storage
 * @param {string} filePath - Chemin local du fichier dans le disque (ex: '/app/temp/contrat-123-signed.pdf')
 * @param {string} storagePath - Chemin dans le bucket (ex: 'consommateurs/nom.pdf')
 * @param {string} bucket - Nom du bucket (obligatoire)
 * @returns {Promise<{ publicUrl: string, fullPath: string }>}
 */


export const uploadToSupabase = async (filePath, storagePath, bucket) => {
  if (!filePath || !storagePath || !bucket) {
    throw new Error('Les paramètres filePath, storagePath et bucket sont requis');
  }
  const fileData = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileData, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) throw new Error('Erreur upload Supabase: ' + error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data || !data.publicUrl) {
    throw new Error('Erreur récupération URL publique');
  }
  return {
    publicUrl: data.publicUrl,
    fullPath: `${bucket}/${storagePath}`,
  };
};

