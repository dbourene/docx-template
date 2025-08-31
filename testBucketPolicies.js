import { createClient } from "npm:@supabase/supabase-js@2.39.2";

const supabase = createClient(
  Deno.env.get("https://jkpugvpeejprxyczkcqt.supabase.co")!,
  Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprcHVndnBlZWpwcnh5Y3prY3F0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzQ2NTU1OSwiZXhwIjoyMDYzMDQxNTU5fQ.hyHxsmejmzN3ulg6NhLN48enGe9_IDkWZVGVejnjmaI")!   // ← la clé service_role
);

// exécuter du SQL brut
await supabase.rpc('pg_execute_sql', {
  sql: `-- --------------------------------------------------------------
-- 0️⃣ Créer le bucket "factures" s’il n’existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('factures', 'factures', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 1️⃣ Activer le Row‑Level Security (si ce n’est pas déjà fait)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 2️⃣ Policies pour le rôle **authenticated**
CREATE POLICY "factures_select_authenticated"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'factures');

CREATE POLICY "factures_insert_authenticated"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'factures');

CREATE POLICY "factures_delete_authenticated"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'factures');

-- --------------------------------------------------------------
-- 3️⃣ Policies pour le rôle **anon**
-- Lecture publique (tout le monde peut télécharger)
CREATE POLICY "factures_select_anon"
  ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'factures');

-- Si vous voulez autoriser l’upload public, décommentez les deux lignes
-- CREATE POLICY "factures_insert_anon"
--   ON storage.objects
--   FOR INSERT TO anon
--   WITH CHECK (bucket_id = 'factures');

-- --------------------------------------------------------------
-- 4️⃣ Policies explicites pour le rôle **service_role**
-- (facultatif – service_role contourne déjà RLS, mais on les rend explicites)
CREATE POLICY "factures_select_service_role"
  ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'factures');

CREATE POLICY "factures_insert_service_role"
  ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'factures');

CREATE POLICY "factures_delete_service_role"
  ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'factures');

-- (Optionnel) UPDATE pour le service_role
-- CREATE POLICY "factures_update_service_role"
--   ON storage.objects
--   FOR UPDATE TO service_role
--   USING (bucket_id = 'factures')
--   WITH CHECK (bucket_id = 'factures');`
});