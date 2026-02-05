# Password SQL Setup

## Important
There is **no default login password** in this project.

Supabase Auth passwords are set by:
1. Supabase Dashboard (Auth → Users → Invite/Create user), or
2. Supabase Admin API / Edge Function (server-side service role key), not regular SQL migrations.

## SQL you should run for profile linkage
Use this SQL after creating Auth users in Supabase Dashboard.

```sql
-- Customers profile links
insert into customers (mill_name, email, auth_user_id)
values
  ('MILL_A', 'customer_a@example.com', 'PUT_AUTH_USER_UUID_HERE')
on conflict (mill_name) do update
set email = excluded.email,
    auth_user_id = excluded.auth_user_id;

-- Employees profile links
insert into employees (role, display_name, auth_user_id)
values
  ('ROLL_CHECKIN', 'Checkin User', 'PUT_AUTH_USER_UUID_HERE'),
  ('CONTROLLER', 'Controller User', 'PUT_AUTH_USER_UUID_HERE'),
  ('GRINDING', 'Grinding User', 'PUT_AUTH_USER_UUID_HERE'),
  ('FLUTING', 'Fluting User', 'PUT_AUTH_USER_UUID_HERE'),
  ('FROSTING', 'Frosting User', 'PUT_AUTH_USER_UUID_HERE'),
  ('CRATING_CHECKING', 'Crating User', 'PUT_AUTH_USER_UUID_HERE'),
  ('DELIVERY', 'Delivery User', 'PUT_AUTH_USER_UUID_HERE'),
  ('ADMIN', 'Admin User', 'PUT_AUTH_USER_UUID_HERE')
on conflict (auth_user_id) do update
set role = excluded.role,
    display_name = excluded.display_name;
```

## Optional SQL checks
```sql
-- Confirm customer linkage
select mill_name, email, auth_user_id from customers order by mill_name;

-- Confirm employee linkage
select role, display_name, auth_user_id from employees order by role;
```

## If you need to reset a password
Do it in Supabase Dashboard (Auth → Users → reset password), or via Admin API.
