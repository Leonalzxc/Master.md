-- ============================================================
-- Fix infinite recursion in profiles RLS policies
-- profiles_admin_read / profiles_admin_update both query
-- public.profiles inside a profiles policy → infinite loop.
-- Solution: SECURITY DEFINER function bypasses RLS when
-- checking the caller's role.
-- ============================================================

-- Helper: check if a given uid has role = 'admin'
-- SECURITY DEFINER + search_path means it reads profiles
-- directly without triggering RLS policies on that table.
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'admin'
  );
$$;

-- Re-create the two offending policies using the helper
DROP POLICY IF EXISTS "profiles_admin_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Same fix for jobs_admin_read (uses identical sub-select pattern)
DROP POLICY IF EXISTS "jobs_admin_read"   ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;

CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin(auth.uid()));
