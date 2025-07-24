// Envoie le PDF dans Supabase Storage

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const uploadToSupabase = async (filePath, storagePath, bucket = 'documents') => {
  const fileData = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileData, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) throw new Error('Erreur upload Supabase: ' + error.message);

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return publicUrl;
};

