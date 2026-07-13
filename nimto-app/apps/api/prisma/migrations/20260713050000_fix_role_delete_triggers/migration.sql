CREATE OR REPLACE FUNCTION prevent_super_admin_role_mutation()
RETURNS trigger AS $$
BEGIN
    IF OLD."name" = 'SUPER_ADMIN' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'SUPER_ADMIN role cannot be deleted';
        END IF;

        IF NEW."name" <> OLD."name" OR NEW."isSystem" IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'SUPER_ADMIN role cannot be renamed or unprotected';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_super_admin_assignment_mutation()
RETURNS trigger AS $$
DECLARE
    is_super_admin_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM "Role"
        WHERE "id" = OLD."roleId"
          AND "name" = 'SUPER_ADMIN'
    ) INTO is_super_admin_role;

    IF is_super_admin_role THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Super Admin role assignment cannot be removed';
        END IF;

        IF NEW."roleId" <> OLD."roleId" OR NEW."userId" <> OLD."userId" THEN
            RAISE EXCEPTION 'Super Admin role assignment cannot be changed';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
