-- Restrict private contact fields that were unintentionally exposed by broad
-- public SELECT grants. Public pages can still read profile/worker metadata,
-- while phone numbers and direct contact handles are returned only through
-- relationship-checked SECURITY DEFINER helpers.

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id,
  role,
  name,
  city,
  created_at,
  blocked_at,
  block_reason
) ON public.profiles TO anon, authenticated;

REVOKE SELECT ON public.profiles_worker FROM anon, authenticated;
GRANT SELECT (
  id,
  categories,
  areas,
  experience_yrs,
  bio,
  photos,
  is_pro,
  pro_until,
  bid_credits,
  rating_avg,
  rating_count,
  verified,
  completed_at,
  verification_submitted_at
) ON public.profiles_worker TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.profile_private_fields(p_profile_id uuid)
RETURNS TABLE (
  name text,
  phone text,
  telegram_chat_id bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.name,
    p.phone,
    CASE WHEN auth.uid() = p_profile_id THEN p.telegram_chat_id ELSE NULL END
  FROM public.profiles p
  WHERE p.id = p_profile_id
    AND (
      auth.uid() = p_profile_id
      OR EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.client_id = p_profile_id
          AND j.selected_worker_id = auth.uid()
          AND j.status = 'in_progress'
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.profile_private_fields(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_private_fields(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.worker_private_contacts(p_worker_id uuid)
RETURNS TABLE (
  viber text,
  telegram text,
  whatsapp text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pw.viber, pw.telegram, pw.whatsapp
  FROM public.profiles_worker pw
  WHERE pw.id = p_worker_id
    AND (
      auth.uid() = p_worker_id
      OR EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.selected_worker_id = p_worker_id
          AND j.client_id = auth.uid()
          AND j.status = 'in_progress'
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.worker_private_contacts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_private_contacts(uuid) TO authenticated;
