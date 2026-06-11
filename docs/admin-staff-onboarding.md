# RENAX Admin Staff Onboarding

Admin accounts are not created from the public Customer app. A real staff account needs both:

- Supabase Auth `app_metadata.role = "admin"`
- An active row in `public.admin_staff_roles`

## Owner Flow

1. Create the staff user in Supabase Auth with their work email.
2. Run one of these SQL commands as the owner/service role:

```sql
select public.provision_admin_staff_by_email(
  'ops.staff@renax.com',
  'hq_ops_admin',
  'Ops Staff Name'
);
```

For a Deliver & Earn-only reviewer:

```sql
select public.provision_admin_staff_by_email(
  'deliver.review@renax.com',
  'deliver_earn_reviewer',
  'Deliver Earn Reviewer'
);
```

3. Tell the staff member to sign out and sign back in at the Admin app.

## Role Keys

- `super_admin`: owner/full access
- `hq_ops_admin`: operations admin, including Deliver & Earn review and invite handoff
- `fleet_manager`: fleet and Deliver & Earn operator management
- `deliver_earn_reviewer`: Deliver & Earn application review and Rider invite handoff only
- `terminal_manager`, `terminal_dispatcher`, `terminal_intake`, `support_readonly`: scoped terminal/support roles

If a staff member can log in but cannot see applications, they are not fully provisioned. Check `admin_staff_roles` first.
