-- Re-assert column-level protection on profiles sensitive fields
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (id, full_name, email, phone, avatar_url, biometric_enabled, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT INSERT (id, full_name, email, phone, avatar_url)
  ON public.profiles TO authenticated;
GRANT UPDATE (full_name, email, phone, avatar_url, biometric_enabled, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

COMMENT ON COLUMN public.profiles.pin_hash IS 'SENSITIVE: never grant SELECT to anon/authenticated. Access only via SECURITY DEFINER functions (has_pin, verify_pin, set_pin).';
COMMENT ON COLUMN public.profiles.biometric_credential IS 'SENSITIVE: never grant SELECT to anon/authenticated. Access only via get_my_biometric().';

-- lease_contracts: writes are RPC-only by design; make it explicit and fail-closed
REVOKE INSERT, UPDATE, DELETE ON TABLE public.lease_contracts FROM anon, authenticated;
GRANT SELECT ON public.lease_contracts TO authenticated;
GRANT ALL ON public.lease_contracts TO service_role;

DROP POLICY IF EXISTS "lease contracts are read only for clients" ON public.lease_contracts;
CREATE POLICY "lease contracts are read only for clients"
  ON public.lease_contracts AS RESTRICTIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (false);

COMMENT ON TABLE public.lease_contracts IS 'Read-only for clients. Rows are created/updated exclusively by the SECURITY DEFINER function generate_lease_contract().';