DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    '_prisma_migrations',
    'AuditLog',
    'BlogPost',
    'DesignCategory',
    'DesignSubcategory',
    'DesignVersion',
    'Event',
    'InvitationDesign',
    'InvitationTemplate',
    'OAuthAccount',
    'PageContent',
    'PasswordResetToken',
    'Permission',
    'Role',
    'RolePermission',
    'User',
    'UserRole',
    'UserSession',
    'VerificationToken'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;
