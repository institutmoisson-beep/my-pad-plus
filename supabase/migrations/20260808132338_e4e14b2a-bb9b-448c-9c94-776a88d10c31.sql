
-- Require an authenticated caller inside every user-callable SECURITY DEFINER function

CREATE OR REPLACE FUNCTION public.search_users(_q text)
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(btrim(_q)) >= 6
    AND (lower(p.email) = lower(btrim(_q)) OR regexp_replace(coalesce(p.phone,''), '\D', '', 'g') = regexp_replace(btrim(_q), '\D', '', 'g'))
  LIMIT 5;
$function$;

CREATE OR REPLACE FUNCTION public.list_landlord_properties(_landlord_id uuid)
 RETURNS TABLE(id uuid, name text, type property_type, rent_amount numeric, due_day integer, city text, district text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.name, p.type, p.rent_amount, p.due_day, p.city, p.district
  FROM public.properties p
  WHERE auth.uid() IS NOT NULL AND p.landlord_id = _landlord_id
  LIMIT 100;
$function$;

CREATE OR REPLACE FUNCTION public.has_pin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND pin_hash IS NOT NULL) $function$;

CREATE OR REPLACE FUNCTION public.verify_pin(_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  SELECT pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN false; END IF;
  RETURN h = crypt(_pin, h);
END; $function$;

CREATE OR REPLACE FUNCTION public.become_landlord()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'landlord') ON CONFLICT DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.assign_tenant(_property_id uuid, _tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _tenant_id = auth.uid() THEN RAISE EXCEPTION 'Vous ne pouvez pas vous assigner vous-même'; END IF;
  SELECT * INTO p FROM public.properties WHERE id = _property_id AND landlord_id = auth.uid();
  IF p IS NULL THEN RAISE EXCEPTION 'Bien introuvable'; END IF;
  INSERT INTO public.tenancies (property_id, tenant_id, landlord_id)
  VALUES (_property_id, _tenant_id, auth.uid())
  ON CONFLICT (property_id, tenant_id) DO UPDATE SET active = true
  RETURNING id INTO tid;
  INSERT INTO public.user_roles (user_id, role) VALUES (_tenant_id, 'tenant') ON CONFLICT DO NOTHING;
  PERFORM public.generate_lease_contract(tid);
  PERFORM public.ensure_rent_cycles(tid);
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (_tenant_id, 'Bien assigné', 'Vous avez été associé au bien ' || p.name || '. Votre contrat de bail est disponible.', 'tenant');
  RETURN tid;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_tenancy(_property_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; tid uuid; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO p FROM public.properties WHERE id = _property_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Bien introuvable'; END IF;
  IF p.landlord_id = auth.uid() THEN RAISE EXCEPTION 'Vous êtes le propriétaire de ce bien'; END IF;
  INSERT INTO public.tenancies (property_id, tenant_id, landlord_id)
  VALUES (_property_id, auth.uid(), p.landlord_id)
  ON CONFLICT (property_id, tenant_id) DO UPDATE SET active = true
  RETURNING id INTO tid;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'tenant') ON CONFLICT DO NOTHING;
  PERFORM public.generate_lease_contract(tid);
  PERFORM public.ensure_rent_cycles(tid);
  SELECT full_name INTO nm FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (p.landlord_id, 'Nouveau locataire',
    'Un nouveau locataire ' || COALESCE(nm,'') || ' s''est associé à votre bien ' || p.name, 'tenant');
  RETURN tid;
END; $function$;

CREATE OR REPLACE FUNCTION public.refresh_my_rent()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  FOR t IN SELECT id FROM public.tenancies WHERE active AND (tenant_id = auth.uid() OR landlord_id = auth.uid()) LOOP
    PERFORM public.ensure_rent_cycles(t.id);
  END LOOP;
END; $function$;

-- Keep privileged/internal helpers unreachable from the API roles
REVOKE ALL ON FUNCTION public.allocate_rent(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_rent_cycles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_lease_contract(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_arrears(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_topup_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_institut_moisson() FROM PUBLIC, anon, authenticated;

-- Re-assert: no anonymous access to any user-callable RPC
REVOKE ALL ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_landlord_properties(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_pin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.become_landlord() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_tenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_tenancy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_my_rent() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_landlord_properties(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tenancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_my_rent() TO authenticated;
