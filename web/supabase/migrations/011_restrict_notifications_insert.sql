-- Restrict notification creation to trusted database-side code.
--
-- SECURITY DEFINER trigger functions that create notifications run with the
-- function owner's privileges, so clients do not need a direct INSERT policy.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
