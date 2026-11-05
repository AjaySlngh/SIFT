-- Custom SQL migration file, put your code below! --

-- Enforce append-only at the database level: a trigger raises an exception
-- rather than silently discarding the write, per the design doc's note that
-- a trigger is stricter than a rule that does-instead-nothing.

create or replace function audit_events_no_mutation()
returns trigger as $$
begin
  raise exception 'audit_events is append-only: % is not allowed', tg_op;
end;
$$ language plpgsql;

create trigger audit_events_no_update
  before update on audit_events
  for each row execute function audit_events_no_mutation();

create trigger audit_events_no_delete
  before delete on audit_events
  for each row execute function audit_events_no_mutation();
