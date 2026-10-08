
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  action text NOT NULL DEFAULT 'page_view',
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_created_idx ON public.activity_events (created_at DESC);
CREATE INDEX activity_events_user_idx ON public.activity_events (user_id, created_at DESC);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.activity_events TO authenticated;
CREATE POLICY "admins read activity" ON public.activity_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  current_path text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  first_seen_today timestamptz NOT NULL DEFAULT now(),
  device text
);
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_presence TO authenticated;
CREATE POLICY "admins read presence" ON public.user_presence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_activity(_path text, _action text, _label text, _device text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(_action,'') <> 'heartbeat' THEN
    INSERT INTO public.activity_events(user_id, path, action, label)
    VALUES (auth.uid(), left(coalesce(_path,'/'),200), left(coalesce(_action,'page_view'),40), left(_label,200));
  END IF;
  INSERT INTO public.user_presence(user_id, current_path, last_seen, device)
  VALUES (auth.uid(), left(coalesce(_path,'/'),200), now(), left(_device,120))
  ON CONFLICT (user_id) DO UPDATE SET current_path = EXCLUDED.current_path, last_seen = now(),
    device = coalesce(EXCLUDED.device, user_presence.device);
END $$;

CREATE OR REPLACE FUNCTION public.set_my_biometric(_cred jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.profiles SET biometric_credential = _cred, biometric_enabled = (_cred IS NOT NULL), updated_at = now()
  WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.admin_analytics(_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(_days,30), 365)));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'online', (SELECT count(*) FROM user_presence WHERE last_seen > now() - interval '2 minutes'),
    'today', (SELECT count(DISTINCT user_id) FROM activity_events WHERE created_at >= date_trunc('day', now())),
    'month', (SELECT count(DISTINCT user_id) FROM activity_events WHERE created_at >= date_trunc('month', now())),
    'total_users', (SELECT count(*) FROM profiles),
    'events', (SELECT count(*) FROM activity_events WHERE created_at >= since),
    'daily', coalesce((SELECT jsonb_agg(x ORDER BY x->>'day') FROM (
        SELECT jsonb_build_object('day', to_char(date_trunc('day', created_at),'YYYY-MM-DD'),
          'users', count(DISTINCT user_id), 'views', count(*)) x
        FROM activity_events WHERE created_at >= since GROUP BY date_trunc('day', created_at)) d), '[]'),
    'monthly', coalesce((SELECT jsonb_agg(x ORDER BY x->>'month') FROM (
        SELECT jsonb_build_object('month', to_char(date_trunc('month', created_at),'YYYY-MM'),
          'users', count(DISTINCT user_id), 'views', count(*)) x
        FROM activity_events WHERE created_at >= now() - interval '12 months' GROUP BY date_trunc('month', created_at)) m), '[]'),
    'top_pages', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('path', path, 'views', count(*), 'users', count(DISTINCT user_id)) x
        FROM activity_events WHERE created_at >= since AND action = 'page_view'
        GROUP BY path ORDER BY count(*) DESC LIMIT 10) t), '[]'),
    'top_actions', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('label', coalesce(label, action), 'count', count(*)) x
        FROM activity_events WHERE created_at >= since AND action <> 'page_view'
        GROUP BY coalesce(label, action) ORDER BY count(*) DESC LIMIT 10) t), '[]')
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.log_activity(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_biometric(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_biometric(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics(int) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
