-- Schema for Fluting Shop workflow

create extension if not exists "pgcrypto";

create type roll_status as enum (
  'CHECKED_IN',
  'AWAITING_CUSTOMER_APPROVAL',
  'REJECTED',
  'SCRAPPED',
  'APPROVED',
  'GRINDING',
  'GRINDING_DONE',
  'FLUTING',
  'FROSTING',
  'FLUTING_DONE',
  'FROSTING_DONE',
  'CRATING_CHECKING',
  'READY_FOR_DELIVERY',
  'DELIVERED'
);

create type employee_role as enum (
  'ROLL_CHECKIN',
  'CONTROLLER',
  'GRINDING',
  'FLUTING',
  'FROSTING',
  'CRATING_CHECKING',
  'DELIVERY',
  'ADMIN'
);

create type roll_priority as enum ('A', 'B');

create table customers (
  id uuid primary key default gen_random_uuid(),
  mill_name text not null unique,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role employee_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table rolls (
  id uuid primary key default gen_random_uuid(),
  roll_id text not null unique,
  roll_name text,
  customer_id uuid not null references customers(id) on delete restrict,
  mill_name text not null,
  date_received date not null,
  checked_in_at timestamptz not null default now(),
  fluting_required boolean not null default false,
  frosting_required boolean not null default false,
  status roll_status not null default 'CHECKED_IN',
  priority roll_priority,
  controller_notes text,
  diameter numeric(10,2),
  visible_cracks boolean,
  cracks_notes text,
  price_quote numeric(12,2),
  fluting_specs text,
  frosting_specs text,
  rejected_note text,
  scrapped_at timestamptz,
  approved_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rolls_customer_id_idx on rolls(customer_id);
create index rolls_status_idx on rolls(status);
create index rolls_priority_checked_in_idx on rolls(priority, checked_in_at);
create index rolls_mill_name_idx on rolls(mill_name);


create table if not exists roll_id_settings (
  id integer primary key default 1 check (id = 1),
  next_value bigint not null default 1000,
  prefix text not null default 'R'
);

insert into roll_id_settings (id, next_value, prefix)
values (1, 1000, 'R')
on conflict (id) do nothing;

create table roll_files (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references rolls(id) on delete cascade,
  file_type text not null check (file_type in ('PHOTO', 'OPTICAL_TEST')),
  file_path text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create index roll_files_roll_id_idx on roll_files(roll_id);

create table roll_history (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references rolls(id) on delete cascade,
  from_status roll_status,
  to_status roll_status not null,
  note text,
  actor_role employee_role,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index roll_history_roll_id_idx on roll_history(roll_id);

create view roll_queue as
select
  r.*, 
  row_number() over (
    order by
      case r.priority when 'A' then 1 when 'B' then 2 else 3 end,
      r.checked_in_at asc
  ) as queue_position
from rolls r
where r.status in ('APPROVED', 'GRINDING_DONE', 'FLUTING_DONE', 'FROSTING_DONE');

create view roll_turnaround_metrics as
select
  avg(extract(epoch from (r.delivered_at - r.checked_in_at)) / 3600) as avg_turnaround_hours,
  max(extract(epoch from (r.delivered_at - r.checked_in_at)) / 3600) as max_turnaround_hours
from rolls r
where r.delivered_at is not null;

create view longest_turnaround_roll as
select
  r.roll_id,
  r.mill_name,
  extract(epoch from (r.delivered_at - r.checked_in_at)) / 3600 as turnaround_hours
from rolls r
where r.delivered_at is not null
order by turnaround_hours desc
limit 1;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rolls_set_updated_at
before update on rolls
for each row
execute function set_updated_at();
