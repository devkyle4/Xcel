-- Admission cycles are versioned: once a cycle leaves draft, or has ever been
-- published, its contents and requirement tree can no longer change. Changes
-- go into a new version. Status and lifecycle timestamps may still change.
-- SQLSTATE 23000 (integrity_constraint_violation) is reported as 409 by the API.

CREATE FUNCTION programme_cycle_is_frozen(cycle programme_admission_cycles) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT cycle.status <> 'draft' OR cycle.published_at IS NOT NULL
$$;
--> statement-breakpoint
CREATE FUNCTION programme_cycle_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF programme_cycle_is_frozen(OLD) THEN
      RAISE EXCEPTION 'Admission cycle % is not a draft and cannot be deleted', OLD.id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF programme_cycle_is_frozen(OLD) AND (
    NEW.programme_id, NEW.academic_year, NEW.version, NEW.supersedes_cycle_id,
    NEW.application_opens_on, NEW.application_deadline, NEW.application_url, NEW.notes
  ) IS DISTINCT FROM (
    OLD.programme_id, OLD.academic_year, OLD.version, OLD.supersedes_cycle_id,
    OLD.application_opens_on, OLD.application_deadline, OLD.application_url, OLD.notes
  ) THEN
    RAISE EXCEPTION 'Admission cycle % is not a draft; create a new version to change it', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER programme_cycles_freeze
  BEFORE UPDATE OR DELETE ON programme_admission_cycles
  FOR EACH ROW EXECUTE FUNCTION programme_cycle_guard();
--> statement-breakpoint
-- Raises if the cycle exists and is frozen. A cycle that no longer exists is
-- being deleted (as a draft), and its tree is removed by cascade.
CREATE FUNCTION assert_cycle_editable(target_cycle_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  frozen boolean;
BEGIN
  SELECT programme_cycle_is_frozen(c) INTO frozen
  FROM programme_admission_cycles c WHERE c.id = target_cycle_id;
  IF frozen THEN
    RAISE EXCEPTION 'Requirements of admission cycle % cannot change; create a new version', target_cycle_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION requirement_group_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM assert_cycle_editable(OLD.cycle_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM assert_cycle_editable(NEW.cycle_id); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER requirement_groups_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON requirement_groups
  FOR EACH ROW EXECUTE FUNCTION requirement_group_guard();
--> statement-breakpoint
CREATE FUNCTION requirement_rule_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM assert_cycle_editable((SELECT cycle_id FROM requirement_groups WHERE id = OLD.group_id));
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM assert_cycle_editable((SELECT cycle_id FROM requirement_groups WHERE id = NEW.group_id));
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER requirement_rules_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON requirement_rules
  FOR EACH ROW EXECUTE FUNCTION requirement_rule_guard();
