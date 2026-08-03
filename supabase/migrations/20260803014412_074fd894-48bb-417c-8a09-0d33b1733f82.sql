
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','landlord','tenant','user');
CREATE TYPE public.property_type AS ENUM ('studio','studio_americain','2_pieces','3_pieces','4_pieces','villa','villa_piscine','appart_1','appart_2','appart_3','magasin','bureau','autre');
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  pin_hash text,
  biometric_enabled boolean NOT NULL DEFAULT false,
  biometric_credential jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- PROFILES policies (public directory search needs limited visibility; allow authenticated read)
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- WALLETS
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROPERTIES
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.property_type NOT NULL DEFAULT 'autre',
  rent_amount numeric(14,2) NOT NULL DEFAULT 0,
  due_day int NOT NULL DEFAULT 5,
  city text,
  district text,
  address text,
  description text,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties visible to authenticated" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "landlord manages own properties" ON public.properties FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- TENANCIES
CREATE TABLE public.tenancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  paid_current_cycle numeric(14,2) NOT NULL DEFAULT 0,
  cycle_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenancies TO authenticated;
GRANT ALL ON public.tenancies TO service_role;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenancy visible to parties" ON public.tenancies FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tenancy created by parties" ON public.tenancies FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid() OR landlord_id = auth.uid());
CREATE POLICY "tenancy updated by parties" ON public.tenancies FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tenancy deleted by landlord" ON public.tenancies FOR DELETE TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- WALLET TRANSACTIONS
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  kind text NOT NULL,
  label text,
  status public.request_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own transactions" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- RENT PAYMENTS
CREATE TABLE public.rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  mode text NOT NULL DEFAULT 'libre',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rent_payments TO authenticated;
GRANT ALL ON public.rent_payments TO service_role;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rent payments visible to parties" ON public.rent_payments FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- DEPOSIT REQUESTS
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  method text NOT NULL,
  reference text,
  proof_url text,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits" ON public.deposit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own deposit" ON public.deposit_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- PAYOUT METHODS
CREATE TABLE public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network text NOT NULL,
  account_name text,
  account_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own payout methods" ON public.payout_methods FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid());

-- WITHDRAWAL REQUESTS
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  fee numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  network text NOT NULL,
  account_number text NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own withdrawal" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_url text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible to parties" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "mark read" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ADMIN SETTINGS
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  withdrawal_fee_percent numeric(6,3) NOT NULL DEFAULT 1.5,
  withdrawal_fee_fixed numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'FCFA',
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.app_settings (id, payment_methods) VALUES (1, '[
 {"name":"Wave","details":"+225 07 00 00 00 01"},
 {"name":"Orange Money","details":"+225 07 00 00 00 02"},
 {"name":"MTN Money","details":"+225 05 00 00 00 03"},
 {"name":"Moov Money","details":"+225 01 00 00 00 04"},
 {"name":"Virement bancaire","details":"IBAN CI00 1234 5678 9012 3456 7890"},
 {"name":"Crypto USDT (TRC20)","details":"TXk9...ImoMSNWallet"}
]'::jsonb);

-- PIN FUNCTIONS
CREATE OR REPLACE FUNCTION public.set_pin(_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  UPDATE public.profiles SET pin_hash = crypt(_pin, gen_salt('bf')), updated_at = now() WHERE id = auth.uid();
END; $$;
GRANT EXECUTE ON FUNCTION public.set_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_pin(_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  SELECT pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN false; END IF;
  RETURN h = crypt(_pin, h);
END; $$;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;

-- RENT PAYMENT RPC
CREATE OR REPLACE FUNCTION public.pay_rent(_tenancy_id uuid, _amount numeric, _mode text DEFAULT 'libre')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; bal numeric; pid uuid;
BEGIN
  SELECT * INTO t FROM public.tenancies WHERE id = _tenancy_id AND tenant_id = auth.uid() AND active;
  IF t IS NULL THEN RAISE EXCEPTION 'Bail introuvable'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  SELECT balance INTO bal FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE user_id = auth.uid();
  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = t.landlord_id;
  UPDATE public.tenancies SET paid_current_cycle = paid_current_cycle + _amount WHERE id = _tenancy_id;
  INSERT INTO public.rent_payments (tenancy_id, tenant_id, landlord_id, amount, mode)
  VALUES (_tenancy_id, auth.uid(), t.landlord_id, _amount, _mode) RETURNING id INTO pid;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, label) VALUES
    (auth.uid(), -_amount, 'rent_payment', 'Paiement de loyer'),
    (t.landlord_id, _amount, 'rent_received', 'Loyer reçu');
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (t.landlord_id, 'Paiement de loyer reçu', 'Vous avez reçu un paiement de ' || _amount::text, 'payment');
  RETURN pid;
END; $$;
GRANT EXECUTE ON FUNCTION public.pay_rent(uuid, numeric, text) TO authenticated;

-- CLAIM TENANCY (user self-associates)
CREATE OR REPLACE FUNCTION public.claim_tenancy(_property_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; tid uuid; nm text;
BEGIN
  SELECT * INTO p FROM public.properties WHERE id = _property_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Bien introuvable'; END IF;
  IF p.landlord_id = auth.uid() THEN RAISE EXCEPTION 'Vous êtes le propriétaire de ce bien'; END IF;
  INSERT INTO public.tenancies (property_id, tenant_id, landlord_id)
  VALUES (_property_id, auth.uid(), p.landlord_id)
  ON CONFLICT (property_id, tenant_id) DO UPDATE SET active = true
  RETURNING id INTO tid;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'tenant') ON CONFLICT DO NOTHING;
  SELECT full_name INTO nm FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (p.landlord_id, 'Nouveau locataire',
    'Un nouveau locataire ' || COALESCE(nm,'') || ' s''est associé à votre bien ' || p.name, 'tenant');
  RETURN tid;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_tenancy(uuid) TO authenticated;

-- ASSIGN TENANT (landlord initiates)
CREATE OR REPLACE FUNCTION public.assign_tenant(_property_id uuid, _tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; tid uuid;
BEGIN
  SELECT * INTO p FROM public.properties WHERE id = _property_id AND landlord_id = auth.uid();
  IF p IS NULL THEN RAISE EXCEPTION 'Bien introuvable'; END IF;
  INSERT INTO public.tenancies (property_id, tenant_id, landlord_id)
  VALUES (_property_id, _tenant_id, auth.uid())
  ON CONFLICT (property_id, tenant_id) DO UPDATE SET active = true
  RETURNING id INTO tid;
  INSERT INTO public.user_roles (user_id, role) VALUES (_tenant_id, 'tenant') ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (_tenant_id, 'Bien assigné', 'Vous avez été associé au bien ' || p.name, 'tenant');
  RETURN tid;
END; $$;
GRANT EXECUTE ON FUNCTION public.assign_tenant(uuid, uuid) TO authenticated;

-- BECOME LANDLORD
CREATE OR REPLACE FUNCTION public.become_landlord()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'landlord') ON CONFLICT DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;

-- ADMIN REVIEW FUNCTIONS
CREATE OR REPLACE FUNCTION public.review_deposit(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT * INTO d FROM public.deposit_requests WHERE id = _id AND status = 'pending';
  IF d IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  UPDATE public.deposit_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END::public.request_status WHERE id = _id;
  IF _approve THEN
    UPDATE public.wallets SET balance = balance + d.amount, updated_at = now() WHERE user_id = d.user_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, label) VALUES (d.user_id, d.amount, 'deposit', 'Rechargement approuvé');
  END IF;
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (d.user_id, CASE WHEN _approve THEN 'Rechargement approuvé' ELSE 'Rechargement rejeté' END, d.amount::text, 'wallet');
END; $$;
GRANT EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_withdrawal(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; bal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT * INTO w FROM public.withdrawal_requests WHERE id = _id AND status = 'pending';
  IF w IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  UPDATE public.withdrawal_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END::public.request_status WHERE id = _id;
  IF _approve THEN
    SELECT balance INTO bal FROM public.wallets WHERE user_id = w.user_id FOR UPDATE;
    IF bal < w.amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;
    UPDATE public.wallets SET balance = balance - w.amount, updated_at = now() WHERE user_id = w.user_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, label) VALUES (w.user_id, -w.amount, 'withdrawal', 'Retrait validé');
  END IF;
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (w.user_id, CASE WHEN _approve THEN 'Retrait validé' ELSE 'Retrait rejeté' END, w.amount::text, 'wallet');
END; $$;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_settings(_methods jsonb, _fee_percent numeric, _fee_fixed numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.app_settings SET payment_methods = _methods, withdrawal_fee_percent = _fee_percent, withdrawal_fee_fixed = _fee_fixed WHERE id = 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(jsonb, numeric, numeric) TO authenticated;

-- Directory search (limited fields) for linking
CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE (id uuid, full_name text, email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.phone FROM public.profiles p
  WHERE _q <> '' AND (p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%')
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
