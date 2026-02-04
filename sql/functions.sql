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

create or replace function set_roll_customer_id()
returns trigger as $$
begin
  if new.customer_id is null then
    select id into new.customer_id
    from customers
    where mill_name = new.mill_name;
  end if;

  if new.customer_id is null then
    raise exception 'Customer not found for mill_name %', new.mill_name;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger rolls_set_customer_id
before insert on rolls
for each row
execute function set_roll_customer_id();
