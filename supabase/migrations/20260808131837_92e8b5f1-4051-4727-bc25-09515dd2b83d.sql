-- 1) Lock down internal SECURITY DEFINER helpers (no anon, no direct authenticated calls)
REVOKE ALL ON FUNCTION public.grant_admin_for_institut_moisson() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_topup_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_rent(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_rent_cycles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_lease_contract(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_arrears(uuid) FROM PUBLIC, anon, authenticated;

-- Ensure no anon execute rights remain on any user-facing definer function
REVOKE ALL ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_tenant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.become_landlord() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_tenancy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.declare_offline_payment(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_pin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_landlord_properties(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_rent(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_my_rent() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_deposit(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_offline_payment(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_withdrawal(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pin(text) FROM PUBLIC, anon;

-- 2) app_settings: admin-only direct reads, controlled accessor for everyone else
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
CREATE POLICY "settings readable by admins"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated;
REVOKE ALL ON public.app_settings FROM anon;

CREATE OR REPLACE FUNCTION public.get_app_settings()
RETURNS TABLE(id integer, payment_methods jsonb, withdrawal_fee_percent numeric, withdrawal_fee_fixed numeric, currency text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.payment_methods, s.withdrawal_fee_percent, s.withdrawal_fee_fixed, s.currency
  FROM public.app_settings s
  WHERE s.id = 1 AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_app_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_settings() TO authenticated;

-- 3) wallets: balances are only mutable through validated server-side flows
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
REVOKE ALL ON public.wallets FROM anon;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;