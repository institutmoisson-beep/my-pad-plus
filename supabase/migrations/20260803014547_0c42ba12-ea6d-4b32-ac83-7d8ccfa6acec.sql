
CREATE POLICY "authed read app media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('property-photos','chat-media'));
CREATE POLICY "authed upload app media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('property-photos','chat-media') AND owner = auth.uid());
CREATE POLICY "owner delete app media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('property-photos','chat-media') AND owner = auth.uid());

CREATE POLICY "upload own proof" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deposit-proofs' AND owner = auth.uid());
CREATE POLICY "read own proof" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deposit-proofs' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
