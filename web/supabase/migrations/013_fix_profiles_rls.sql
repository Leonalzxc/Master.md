-- ============================================================
-- Fix infinite recursion in admin RLS policies on profiles/jobs
-- ============================================================
-- The policies created in 011 used a subquery on profiles to check
-- if the current user is admin. But because profiles itself has RLS
-- enabled, this subquery triggers the same policy, causing infinite
-- recursion: "infinite recursion detected in policy for relation profiles"
--
-- Fix: introduce a SECURITY DEFINER helper function that reads profiles
-- without RLS enforcement, then rewrite the four affected policies to use it.
-- ============================================================

-- 1. SECURITY DEFINER helper — reads profiles bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'admin'
  );
$$;

-- 2. Drop the four recursive policies from migration 011
DROP POLICY IF EXISTS "profiles_admin_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "jobs_admin_read"        ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"      ON public.jobs;

-- 3. Re-create them using the SECURITY DEFINER function (no recursion)
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin(auth.uid()));
