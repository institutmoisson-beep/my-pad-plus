-- 1. PROFILES ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "profiles readable to self, related parties and admins"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.tenancies t
    WHERE t.active
      AND ((t.tenant_id = auth.uid() AND t.landlord_id = profiles.id)
        OR (t.landlord_id = auth.uid() AND t.tenant_id = profiles.id))
  )
);

-- hide the PIN hash from the Data API entirely (verified via verify_pin RPC)
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, email, phone, avatar_url, biometric_enabled, biometric_credential, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.has_pin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND pin_hash IS NOT NULL) $$;

-- 2. SEARCH USERS: exact match only, minimal columns ----------------------
DROP FUNCTION IF EXISTS public.search_users(text);
CREATE FUNCTION public.search_users(_q text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name FROM public.profiles p
  WHERE length(btrim(_q)) >= 6
    AND (lower(p.email) = lower(btrim(_q)) OR regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(btrim(_q), '\D', '', 'g'))
  LIMIT 5;
$$;

-- 3. PROPERTIES -----------------------------------------------------------
DROP POLICY IF EXISTS "properties visible to authenticated" ON public.properties;

CREATE POLICY "properties visible to parties"
ON public.properties FOR SELECT TO authenticated
USING (
  landlord_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.tenancies t WHERE t.property_id = properties.id AND t.tenant_id = auth.uid() AND t.active)
);

CREATE OR REPLACE FUNCTION public.list_landlord_properties(_landlord_id uuid)
RETURNS TABLE(id uuid, name text, type property_type, rent_amount numeric, due_day integer, city text, district text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.name, p.type, p.rent_amount, p.due_day, p.city, p.district
  FROM public.properties p
  WHERE p.landlord_id = _landlord_id
  LIMIT 100;
$$;

-- 4. STORAGE --------------------------------------------------------------
DROP POLICY IF EXISTS "authed read app media" ON storage.objects;
DROP POLICY IF EXISTS "authed upload app media" ON storage.objects;

CREATE POLICY "upload app media in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['property-photos','chat-media'])
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "read chat media between correspondents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.sender_id = owner AND m.recipient_id = auth.uid())
         OR (m.recipient_id = owner AND m.sender_id = auth.uid())
    )
  )
);

CREATE POLICY "read property photos for related users"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      WHERE t.landlord_id = owner AND t.tenant_id = auth.uid() AND t.active
    )
  )
);

-- 5. FUNCTION EXECUTE GRANTS ---------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.become_landlord() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_tenancy(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_rent(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_withdrawal(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_pin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_pin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_pin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_landlord_properties(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tenancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_rent(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_landlord_properties(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;