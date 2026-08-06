-- ============ LEASE CONTRACTS ============
CREATE TABLE public.lease_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL UNIQUE REFERENCES public.tenancies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  reference text NOT NULL UNIQUE,
  rent_amount numeric NOT NULL DEFAULT 0,
  due_day integer NOT NULL DEFAULT 5,
  deposit_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT current_date,
  duration_months integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lease_contracts TO authenticated;
GRANT ALL ON public.lease_contracts TO service_role;
ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lease visible to parties" ON public.lease_contracts FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ RENT CYCLES ============
CREATE TABLE public.rent_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  period date NOT NULL,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  late_notified_at timestamptz,
  formal_notice_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenancy_id, period)
);
GRANT SELECT ON public.rent_cycles TO authenticated;
GRANT ALL ON public.rent_cycles TO service_role;
ALTER TABLE public.rent_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycles visible to parties" ON public.rent_cycles FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX rent_cycles_tenancy_period_idx ON public.rent_cycles (tenancy_id, period);

-- ============ OFFLINE PAYMENT CLAIMS ============
CREATE TABLE public.offline_payment_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.rent_cycles(id) ON DELETE CASCADE,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  amount numeric NOT NULL,
  note text,
  status public.request_status NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offline_payment_claims TO authenticated;
GRANT ALL ON public.offline_payment_claims TO service_role;
ALTER TABLE public.offline_payment_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims visible to parties" ON public.offline_payment_claims FOR SELECT TO authenticated
  USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ CONTRACT GENERATION ============
CREATE OR REPLACE FUNCTION public.generate_lease_contract(_tenancy_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; p record; cid uuid; ref text;
BEGIN
  SELECT * INTO t FROM public.tenancies WHERE id = _tenancy_id;
  IF t IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.properties WHERE id = t.property_id;
  ref := 'IMO-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(_tenancy_id::text,'-',''),1,8));
  INSERT INTO public.lease_contracts (tenancy_id, property_id, landlord_id, tenant_id, reference,
    rent_amount, due_day, deposit_amount, start_date)
  VALUES (t.id, t.property_id, t.landlord_id, t.tenant_id, ref,
    COALESCE(p.rent_amount,0), COALESCE(p.due_day,5), COALESCE(p.rent_amount,0) * 2, t.cycle_start)
  ON CONFLICT (tenancy_id) DO UPDATE SET rent_amount = EXCLUDED.rent_amount, due_day = EXCLUDED.due_day, updated_at = now()
  RETURNING id INTO cid;
  RETURN cid;
END; $$;

-- ============ CYCLES ============
CREATE OR REPLACE FUNCTION public.ensure_rent_cycles(_tenancy_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; p record; m date; cur date := date_trunc('month', now())::date; c record;
BEGIN
  SELECT * INTO t FROM public.tenancies WHERE id = _tenancy_id AND active;
  IF t IS NULL THEN RETURN; END IF;
  SELECT * INTO p FROM public.properties WHERE id = t.property_id;
  m := date_trunc('month', t.cycle_start)::date;
  WHILE m <= cur LOOP
    INSERT INTO public.rent_cycles (tenancy_id, tenant_id, landlord_id, period, amount_due, due_date)
    VALUES (t.id, t.tenant_id, t.landlord_id, m, COALESCE(p.rent_amount,0),
            m + (LEAST(COALESCE(p.due_day,5),28) - 1))
    ON CONFLICT (tenancy_id, period) DO NOTHING;
    m := (m + interval '1 month')::date;
  END LOOP;

  UPDATE public.rent_cycles SET
    status = CASE WHEN amount_paid >= amount_due THEN 'paid'
                  WHEN due_date < current_date THEN 'late'
                  WHEN amount_paid > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = now()
  WHERE tenancy_id = _tenancy_id;

  FOR c IN SELECT * FROM public.rent_cycles
           WHERE tenancy_id = _tenancy_id AND status = 'late' AND late_notified_at IS NULL LOOP
    INSERT INTO public.notifications (user_id, title, body, kind) VALUES
      (c.tenant_id, 'Loyer en retard',
       'Le loyer de ' || to_char(c.period,'MM/YYYY') || ' est en retard. Reste ' || (c.amount_due - c.amount_paid)::text || '. Régularisez pour éviter une mise en demeure.', 'rent'),
      (c.landlord_id, 'Loyer en retard',
       'Le loyer de ' || to_char(c.period,'MM/YYYY') || ' de votre locataire est en retard.', 'rent');
    UPDATE public.rent_cycles SET late_notified_at = now() WHERE id = c.id;
  END LOOP;

  FOR c IN SELECT * FROM public.rent_cycles
           WHERE tenancy_id = _tenancy_id AND status = 'late'
             AND formal_notice_at IS NULL AND due_date < current_date - 15 LOOP
    INSERT INTO public.notifications (user_id, title, body, kind) VALUES
      (c.tenant_id, 'Mise en demeure',
       'Mise en demeure de payer le loyer de ' || to_char(c.period,'MM/YYYY') || ' sous 30 jours, conformément au contrat de bail et à la loi ivoirienne.', 'rent'),
      (c.landlord_id, 'Mise en demeure émise',
       'Une mise en demeure a été émise pour le loyer de ' || to_char(c.period,'MM/YYYY') || '.', 'rent');
    UPDATE public.rent_cycles SET formal_notice_at = now() WHERE id = c.id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_my_rent()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenancies WHERE active AND (tenant_id = auth.uid() OR landlord_id = auth.uid()) LOOP
    PERFORM public.ensure_rent_cycles(t.id);
  END LOOP;
END; $$;

-- allocate an amount across unpaid cycles, oldest first
CREATE OR REPLACE FUNCTION public.allocate_rent(_tenancy_id uuid, _amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE left_amt numeric := _amount; c record; take numeric;
BEGIN
  FOR c IN SELECT * FROM public.rent_cycles
           WHERE tenancy_id = _tenancy_id AND amount_paid < amount_due ORDER BY period LOOP
    EXIT WHEN left_amt <= 0;
    take := LEAST(left_amt, c.amount_due - c.amount_paid);
    UPDATE public.rent_cycles SET amount_paid = amount_paid + take,
      status = CASE WHEN amount_paid + take >= amount_due THEN 'paid' ELSE
        CASE WHEN due_date < current_date THEN 'late' ELSE 'partial' END END,
      updated_at = now() WHERE id = c.id;
    left_amt := left_amt - take;
  END LOOP;
  UPDATE public.tenancies SET paid_current_cycle = COALESCE((
    SELECT amount_paid FROM public.rent_cycles
    WHERE tenancy_id = _tenancy_id AND period = date_trunc('month', now())::date), 0)
  WHERE id = _tenancy_id;
  RETURN _amount - left_amt;
END; $$;

-- ============ PAY RENT (rewritten to use cycles) ============
CREATE OR REPLACE FUNCTION public.pay_rent(_tenancy_id uuid, _amount numeric, _mode text DEFAULT 'libre'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; bal numeric; pid uuid; applied numeric;
BEGIN
  SELECT * INTO t FROM public.tenancies WHERE id = _tenancy_id AND tenant_id = auth.uid() AND active;
  IF t IS NULL THEN RAISE EXCEPTION 'Bail introuvable'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  PERFORM public.ensure_rent_cycles(_tenancy_id);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;

  applied := public.allocate_rent(_tenancy_id, _amount);
  IF applied <= 0 THEN RAISE EXCEPTION 'Aucun loyer à payer'; END IF;

  UPDATE public.wallets SET balance = balance - applied, updated_at = now() WHERE user_id = auth.uid();
  UPDATE public.wallets SET balance = balance + applied, updated_at = now() WHERE user_id = t.landlord_id;
  INSERT INTO public.rent_payments (tenancy_id, tenant_id, landlord_id, amount, mode)
  VALUES (_tenancy_id, auth.uid(), t.landlord_id, applied, _mode) RETURNING id INTO pid;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, label) VALUES
    (auth.uid(), -applied, 'rent_payment', 'Paiement de loyer'),
    (t.landlord_id, applied, 'rent_received', 'Loyer reçu');
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (t.landlord_id, 'Paiement de loyer reçu', 'Vous avez reçu un paiement de ' || applied::text, 'payment');
  RETURN pid;
END; $$;

-- ============ AUTO SETTLEMENT ON WALLET TOP-UP ============
CREATE OR REPLACE FUNCTION public.settle_arrears(_user_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; c record; bal numeric; take numeric; total numeric := 0;
BEGIN
  FOR t IN SELECT * FROM public.tenancies WHERE tenant_id = _user_id AND active LOOP
    PERFORM public.ensure_rent_cycles(t.id);
    FOR c IN SELECT * FROM public.rent_cycles
             WHERE tenancy_id = t.id AND amount_paid < amount_due
               AND period < date_trunc('month', now())::date
             ORDER BY period LOOP
      SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
      EXIT WHEN COALESCE(bal,0) <= 0;
      take := LEAST(bal, c.amount_due - c.amount_paid);
      IF take <= 0 THEN CONTINUE; END IF;
      UPDATE public.rent_cycles SET amount_paid = amount_paid + take,
        status = CASE WHEN amount_paid + take >= amount_due THEN 'paid' ELSE 'late' END,
        updated_at = now() WHERE id = c.id;
      UPDATE public.wallets SET balance = balance - take, updated_at = now() WHERE user_id = _user_id;
      UPDATE public.wallets SET balance = balance + take, updated_at = now() WHERE user_id = t.landlord_id;
      INSERT INTO public.rent_payments (tenancy_id, tenant_id, landlord_id, amount, mode)
      VALUES (t.id, _user_id, t.landlord_id, take, 'prelevement_auto');
      INSERT INTO public.wallet_transactions (user_id, amount, kind, label) VALUES
        (_user_id, -take, 'rent_payment', 'Prélèvement automatique loyer ' || to_char(c.period,'MM/YYYY')),
        (t.landlord_id, take, 'rent_received', 'Loyer ' || to_char(c.period,'MM/YYYY') || ' (prélèvement auto)');
      INSERT INTO public.notifications (user_id, title, body, kind) VALUES
        (_user_id, 'Prélèvement automatique', take::text || ' prélevé pour le loyer de ' || to_char(c.period,'MM/YYYY'), 'rent'),
        (t.landlord_id, 'Loyer reçu', take::text || ' reçu pour ' || to_char(c.period,'MM/YYYY'), 'payment');
      total := total + take;
    END LOOP;
  END LOOP;
  RETURN total;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_topup_settle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.balance > OLD.balance THEN
    PERFORM public.settle_arrears(NEW.user_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS wallets_settle_arrears ON public.wallets;
CREATE TRIGGER wallets_settle_arrears AFTER UPDATE OF balance ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.wallet_topup_settle();

-- ============ OFFLINE PAYMENT FLOW ============
CREATE OR REPLACE FUNCTION public.declare_offline_payment(_cycle_id uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; cid uuid;
BEGIN
  SELECT * INTO c FROM public.rent_cycles WHERE id = _cycle_id AND tenant_id = auth.uid();
  IF c IS NULL THEN RAISE EXCEPTION 'Échéance introuvable'; END IF;
  IF _amount <= 0 OR _amount > (c.amount_due - c.amount_paid) THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF EXISTS (SELECT 1 FROM public.offline_payment_claims WHERE cycle_id = _cycle_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Une déclaration est déjà en attente pour ce mois';
  END IF;
  INSERT INTO public.offline_payment_claims (cycle_id, tenancy_id, tenant_id, landlord_id, amount, note)
  VALUES (_cycle_id, c.tenancy_id, c.tenant_id, c.landlord_id, _amount, _note) RETURNING id INTO cid;
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (c.landlord_id, 'Paiement hors application déclaré',
    'Votre locataire déclare avoir payé ' || _amount::text || ' pour ' || to_char(c.period,'MM/YYYY') || '. Confirmez ou rejetez.', 'rent');
  RETURN cid;
END; $$;

CREATE OR REPLACE FUNCTION public.review_offline_payment(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cl record; c record;
BEGIN
  SELECT * INTO cl FROM public.offline_payment_claims WHERE id = _id AND status = 'pending'
    AND (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  IF cl IS NULL THEN RAISE EXCEPTION 'Déclaration introuvable'; END IF;
  UPDATE public.offline_payment_claims
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END::public.request_status,
        reviewed_at = now() WHERE id = _id;
  IF _approve THEN
    SELECT * INTO c FROM public.rent_cycles WHERE id = cl.cycle_id;
    UPDATE public.rent_cycles SET amount_paid = LEAST(amount_due, amount_paid + cl.amount),
      status = CASE WHEN amount_paid + cl.amount >= amount_due THEN 'paid'
                    WHEN due_date < current_date THEN 'late' ELSE 'partial' END,
      updated_at = now() WHERE id = cl.cycle_id;
    INSERT INTO public.rent_payments (tenancy_id, tenant_id, landlord_id, amount, mode)
    VALUES (cl.tenancy_id, cl.tenant_id, cl.landlord_id, cl.amount, 'hors_application');
    UPDATE public.tenancies SET paid_current_cycle = COALESCE((
      SELECT amount_paid FROM public.rent_cycles
      WHERE tenancy_id = cl.tenancy_id AND period = date_trunc('month', now())::date), 0)
    WHERE id = cl.tenancy_id;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (cl.tenant_id,
    CASE WHEN _approve THEN 'Paiement hors application confirmé' ELSE 'Paiement hors application rejeté' END,
    CASE WHEN _approve THEN 'Le propriétaire a confirmé votre paiement de ' || cl.amount::text
         ELSE 'Le propriétaire a rejeté votre déclaration. Le prélèvement automatique reste actif.' END, 'rent');
END; $$;

-- ============ HOOK CONTRACT + CYCLES INTO LINKING ============
CREATE OR REPLACE FUNCTION public.assign_tenant(_property_id uuid, _tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record; tid uuid;
BEGIN
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
END; $$;

CREATE OR REPLACE FUNCTION public.claim_tenancy(_property_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  PERFORM public.generate_lease_contract(tid);
  PERFORM public.ensure_rent_cycles(tid);
  SELECT full_name INTO nm FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (p.landlord_id, 'Nouveau locataire',
    'Un nouveau locataire ' || COALESCE(nm,'') || ' s''est associé à votre bien ' || p.name, 'tenant');
  RETURN tid;
END; $$;

-- backfill existing tenancies
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT id FROM public.tenancies WHERE active LOOP
    PERFORM public.generate_lease_contract(t.id);
    PERFORM public.ensure_rent_cycles(t.id);
  END LOOP;
END $$;

-- ============ EXECUTE GRANTS ============
REVOKE EXECUTE ON FUNCTION public.generate_lease_contract(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_rent_cycles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.allocate_rent(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settle_arrears(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_topup_settle() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_my_rent() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.declare_offline_payment(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_offline_payment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_my_rent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.declare_offline_payment(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_offline_payment(uuid, boolean) TO authenticated;