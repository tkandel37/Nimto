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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_super_admin_role
BEFORE UPDATE OR DELETE ON "Role"
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_role_mutation();

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_super_admin_user
BEFORE UPDATE OR DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_user_mutation();

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_super_admin_assignment
BEFORE UPDATE OR DELETE ON "UserRole"
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_assignment_mutation();
