
DROP POLICY "insert notifications" ON public.notifications;
CREATE POLICY "insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.set_pin(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_pin(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.pay_rent(uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_tenancy(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.become_landlord() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.review_withdrawal(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.set_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_rent(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tenancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
