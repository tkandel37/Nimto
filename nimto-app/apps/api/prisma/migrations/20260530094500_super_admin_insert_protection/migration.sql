CREATE OR REPLACE FUNCTION prevent_super_admin_role_mutation()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."name" = 'SUPER_ADMIN' AND NEW."isSystem" IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'SUPER_ADMIN role must be protected';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD."name" = 'SUPER_ADMIN' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'SUPER_ADMIN role cannot be deleted';
        END IF;

        IF NEW."name" <> OLD."name" OR NEW."isSystem" IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'SUPER_ADMIN role cannot be renamed or unprotected';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW."name" = 'SUPER_ADMIN' AND NEW."isSystem" IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'SUPER_ADMIN role must be protected';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "protect_super_admin_role" ON "Role";

CREATE TRIGGER protect_super_admin_role
BEFORE INSERT OR UPDATE OR DELETE ON "Role"
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_role_mutation();
