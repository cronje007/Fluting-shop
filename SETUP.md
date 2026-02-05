# Fluting Shop Setup Guide

## 1) Supabase project setup
1. Create a new Supabase project.
2. In the SQL editor, run the files in this order:
   1. `sql/schema.sql`
   2. `sql/functions.sql`
   3. `sql/rls_policies.sql`
   - Updated copies are also available in `NEW SQL/` if you need the latest files.
3. Create two Auth user groups:
   - Customers (email + password)
   - Employees (email + password)
4. Insert customer and employee records and link them to Auth users by setting:
   - `customers.auth_user_id`
   - `employees.auth_user_id`
5. Admins can also use the Admin dashboard to create customer/employee profiles after Auth users exist.

## 2) Storage buckets
Create two storage buckets in Supabase Storage:
- `roll-photos` (for check-in photos)
- `optical-tests` (for PDF/image optical tests)

Recommended bucket policies (pseudocode):
- **Customers** can read objects where the roll belongs to their customer.
- **Employees** can read/write objects where they are assigned the stage.
- **Admins** can read/write any object.

## 3) Environment variables
In the frontend, set:
- `VITE_SUPABASE_URL` (or `SUPABASE_URL` if using vanilla JS)
- `VITE_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`)

## 4) Barcode printing and scanning
- Barcodes encode the **Roll ID**.
- The web app uses a barcode library (e.g., JsBarcode) to render a printable label.
- For scanning, any USB barcode scanner can be used: it behaves like a keyboard and fills the scan input.
- The Roll ID scan input automatically queries the roll and navigates to the details pane.

## 5) Email notifications
Two emails are required:
1. **Controller approval request**: when a roll moves to `AWAITING_CUSTOMER_APPROVAL`.
2. **Delivery ready**: when a roll moves to `READY_FOR_DELIVERY`.

Recommended approach:
- Use Supabase Edge Functions and a transactional email provider (SendGrid, Postmark, etc.).
- Trigger an Edge Function call from the frontend or with a DB trigger.
- Include a link to the customer dashboard in the email.

## 6) Running the site locally
This repo ships a plain HTML/CSS/JS frontend with **separate role dashboards**.
1. Open `public/index.html` in a browser.
2. Update `public/app.js` with your Supabase URL and anon key.
3. Login using either a customer or employee account.

Dashboard pages:
- `public/customer.html`
- `public/roll-checkin.html`
- `public/controller.html`
- `public/grinding.html`
- `public/fluting.html`
- `public/frosting.html`
- `public/crating.html`
- `public/delivery.html`
- `public/admin.html`

## 7) Troubleshooting roll creation
If you see `new row violates row-level security policy for table \"rolls\"` when creating a roll:
- Ensure the logged-in user has an `employees` record with role `ROLL_CHECKIN`.
- Ensure the `mill_name` entered matches a row in `customers` (the insert trigger resolves `customer_id`).

## 8) Workflow notes
- Rolls in `SCRAPPED` are read-only for all roles.
- Queue ordering uses Priority A → Priority B, then oldest `checked_in_at` first.
- Only `APPROVED` rolls enter production queues.


## One-section SQL for existing projects

If your project already exists and you only need the latest workflow/RLS fixes, run:

- `sql/existing_project_patch.sql`

(Equivalent copy: `NEW SQL/existing_project_patch.sql`)

This single script includes transition trigger enforcement + status-history trigger refresh + RLS helper functions + required roll update policies.


## 9) Roll ID Counter (Admin + Check-in)
- Admin can set the next generated roll number from the Admin dashboard.
- Roll Check-in can click **Generate New Unique ID** to get the next ID from SQL function `next_roll_id()` (auto increments).
- If a typed Roll ID already exists, check-in is prompted to create a rework ID (`<ROLL_ID>-R1`, `-R2`, ...).
