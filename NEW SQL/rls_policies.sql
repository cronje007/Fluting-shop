-- Enable RLS
alter table customers enable row level security;
alter table employees enable row level security;
alter table rolls enable row level security;
alter table roll_files enable row level security;
alter table roll_history enable row level security;

create or replace function current_employee_role()
returns employee_role as $$
  select role from employees where auth_user_id = auth.uid();
$$ language sql stable security definer;

create or replace function current_customer_id()
returns uuid as $$
  select id from customers where auth_user_id = auth.uid();
$$ language sql stable security definer;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role = 'ADMIN'
  );
$$ language sql stable security definer;

-- Customers table policies
create policy "Customers can view own record"
  on customers for select
  using (auth_user_id = auth.uid());

create policy "Admins can view customers"
  on customers for select
  using (is_admin());

create policy "Admins can insert customers"
  on customers for insert
  with check (is_admin());

create policy "Admins can update customers"
  on customers for update
  using (is_admin())
  with check (is_admin());

-- Employees table policies
create policy "Employees can view own record"
  on employees for select
  using (auth_user_id = auth.uid());

create policy "Admins can view employees"
  on employees for select
  using (is_admin());

create policy "Admins can insert employees"
  on employees for insert
  with check (is_admin());

create policy "Admins can update employees"
  on employees for update
  using (is_admin())
  with check (is_admin());

-- Rolls policies
create policy "Customers can view own rolls"
  on rolls for select
  using (customer_id = current_customer_id());

create policy "Employees can view assigned stage"
  on rolls for select
  using (
    is_admin()
    or (
      current_employee_role() = 'ROLL_CHECKIN'
    )
    or (
      current_employee_role() = 'CONTROLLER'
      and status in ('CHECKED_IN', 'AWAITING_CUSTOMER_APPROVAL', 'REJECTED', 'SCRAPPED')
    )
    or (
      current_employee_role() = 'GRINDING'
      and status in ('APPROVED', 'GRINDING')
    )
    or (
      current_employee_role() = 'FLUTING'
      and status in ('GRINDING_DONE', 'FLUTING')
    )
    or (
      current_employee_role() = 'FROSTING'
      and status in ('GRINDING_DONE', 'FROSTING')
    )
    or (
      current_employee_role() = 'CRATING_CHECKING'
      and status in ('FLUTING_DONE', 'FROSTING_DONE', 'GRINDING_DONE', 'CRATING_CHECKING')
    )
    or (
      current_employee_role() = 'DELIVERY'
      and status in ('READY_FOR_DELIVERY', 'DELIVERED')
    )
  );

create policy "Employees can insert rolls"
  on rolls for insert
  with check (current_employee_role() = 'ROLL_CHECKIN' or is_admin());

create policy "Employees can update rolls"
  on rolls for update
  using (
    is_admin() or current_employee_role() is not null
  )
  with check (
    is_admin() or current_employee_role() is not null
  );

-- Roll files policies
create policy "Customers can view their files"
  on roll_files for select
  using (exists (
    select 1 from rolls r
    where r.id = roll_files.roll_id
      and r.customer_id = current_customer_id()
  ));

create policy "Employees can view roll files"
  on roll_files for select
  using (
    is_admin() or current_employee_role() is not null
  );

create policy "Employees can insert roll files"
  on roll_files for insert
  with check (
    is_admin() or current_employee_role() is not null
  );

-- Roll history policies
create policy "Customers can view roll history"
  on roll_history for select
  using (exists (
    select 1 from rolls r
    where r.id = roll_history.roll_id
      and r.customer_id = current_customer_id()
  ));

create policy "Employees can view roll history"
  on roll_history for select
  using (
    is_admin() or current_employee_role() is not null
  );
