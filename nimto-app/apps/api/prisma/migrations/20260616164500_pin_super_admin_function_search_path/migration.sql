ALTER FUNCTION public.prevent_super_admin_role_mutation()
SET search_path = public, pg_temp;

ALTER FUNCTION public.prevent_super_admin_user_mutation()
SET search_path = public, pg_temp;

ALTER FUNCTION public.prevent_super_admin_assignment_mutation()
SET search_path = public, pg_temp;
