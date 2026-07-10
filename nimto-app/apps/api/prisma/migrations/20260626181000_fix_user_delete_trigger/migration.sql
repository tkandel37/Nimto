CREATE OR REPLACE FUNCTION prevent_super_admin_user_mutation()
RETURNS trigger AS $$
DECLARE
    has_super_admin_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM "UserRole" ur
        JOIN "Role" r ON r."id" = ur."roleId"
        WHERE ur."userId" = OLD."id"
          AND r."name" = 'SUPER_ADMIN'
    ) INTO has_super_admin_role;

    IF has_super_admin_role THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Super Admin user cannot be deleted';
        END IF;

        IF NEW."status" <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Super Admin user cannot be deactivated, blocked, or marked pending deletion';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
