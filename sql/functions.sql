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

create or replace function enforce_roll_status_transition()
returns trigger as $$
declare
  allowed boolean := false;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := (
    (old.status = 'CHECKED_IN' and new.status = 'AWAITING_CUSTOMER_APPROVAL')
    or (old.status = 'AWAITING_CUSTOMER_APPROVAL' and new.status in ('APPROVED', 'REJECTED', 'SCRAPPED'))
    or (old.status = 'REJECTED' and new.status = 'AWAITING_CUSTOMER_APPROVAL')
    or (old.status = 'APPROVED' and new.status = 'GRINDING')
    or (old.status = 'GRINDING' and new.status = 'GRINDING_DONE')
    or (old.status = 'GRINDING_DONE' and new.status in ('FLUTING', 'FROSTING', 'CRATING_CHECKING'))
    or (old.status = 'FLUTING' and new.status = 'FLUTING_DONE')
    or (old.status = 'FROSTING' and new.status = 'FROSTING_DONE')
    or (old.status in ('FLUTING_DONE', 'FROSTING_DONE', 'CRATING_CHECKING') and new.status = 'READY_FOR_DELIVERY')
    or (old.status = 'READY_FOR_DELIVERY' and new.status = 'DELIVERED')
  );

  if old.status = 'SCRAPPED' then
    raise exception 'SCRAPPED rolls are final and cannot move to %', new.status;
  end if;

  if old.status = 'DELIVERED' then
    raise exception 'DELIVERED rolls are final and cannot move to %', new.status;
  end if;

  if not allowed then
    raise exception 'Invalid roll status transition: % -> %', old.status, new.status;
  end if;

  if new.status = 'APPROVED' and new.approved_at is null then
    new.approved_at := now();
  end if;

  if new.status = 'SCRAPPED' and new.scrapped_at is null then
    new.scrapped_at := now();
  end if;

  if new.status = 'DELIVERED' and new.delivered_at is null then
    new.delivered_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists rolls_enforce_status_transition on rolls;
create trigger rolls_enforce_status_transition
before update of status on rolls
for each row
execute function enforce_roll_status_transition();


create or replace function next_roll_id()
returns text as $$
declare
  v_prefix text;
  v_next bigint;
begin
  if not exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role in ('ROLL_CHECKIN', 'ADMIN')
  ) then
    raise exception 'Only Roll Check-in or Admin can generate new roll IDs';
  end if;

  update roll_id_settings
  set next_value = next_value + 1
  where id = 1
  returning prefix, next_value - 1 into v_prefix, v_next;

  if v_prefix is null then
    insert into roll_id_settings (id, next_value, prefix)
    values (1, 1001, 'R')
    on conflict (id) do update set next_value = roll_id_settings.next_value + 1
    returning prefix, next_value - 1 into v_prefix, v_next;
  end if;

  return v_prefix || lpad(v_next::text, 6, '0');
end;
$$ language plpgsql security definer;

create or replace function set_roll_id_counter(p_value bigint)
returns void as $$
begin
  if not exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role = 'ADMIN'
  ) then
    raise exception 'Only Admin can update roll ID counter';
  end if;

  if p_value < 1 then
    raise exception 'Counter must be >= 1';
  end if;

  insert into roll_id_settings (id, next_value, prefix)
  values (1, p_value, 'R')
  on conflict (id) do update set next_value = excluded.next_value;
end;
$$ language plpgsql security definer;

create or replace function get_current_roll_id_counter()
returns bigint as $$
  select next_value from roll_id_settings where id = 1;
$$ language sql stable security definer;
