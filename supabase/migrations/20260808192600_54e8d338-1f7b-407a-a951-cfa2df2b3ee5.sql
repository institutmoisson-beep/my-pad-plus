-- Column-level SELECT: exclude pin_hash and biometric_credential entirely
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, email, phone, avatar_url, biometric_enabled, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Owner-only access to own biometric credential
CREATE OR REPLACE FUNCTION public.get_my_biometric()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.biometric_credential FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_biometric() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_biometric() TO authenticated;