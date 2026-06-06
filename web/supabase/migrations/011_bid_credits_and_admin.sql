-- ============================================================
-- Atomic bid-credit deduction (prevents race conditions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = p_worker_id
  FOR UPDATE;           -- row-level lock to prevent race condition

  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN false;
  END IF;

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

-- ============================================================
-- Allow admins to read all profiles (for admin panel)
-- ============================================================
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- Allow admins to update any profile (block/unblock)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- Allow admins to read all jobs
CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );

-- Allow admins to update any job (block)
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
  );
