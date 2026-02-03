create or replace function log_roll_status_change()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into roll_history (
      roll_id,
      from_status,
      to_status,
      note,
      actor_role,
      actor_user_id
    ) values (
      new.id,
      old.status,
      new.status,
      coalesce(new.rejected_note, null),
      null,
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger rolls_log_status_change
after update of status on rolls
for each row
execute function log_roll_status_change();
