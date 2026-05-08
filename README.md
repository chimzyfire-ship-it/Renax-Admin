# RENAX Admin

RENAX Admin is the operations command center for the RENAX logistics network. It is built for dispatch, support, and ops teams who need a live picture of shipment flow, rider activity, terminal pressure, exceptions, and delivery performance from one place.

## What this app handles

- Live operations monitoring across shipments, riders, terminals, and dispatch stages
- Admin-only access gates using Supabase auth claims
- Shipment oversight with stage events, proof trails, routing review, and exception handling
- Rider and driver visibility with availability, assignment context, and terminal alignment
- Operational alerting through admin notifications, queue monitoring, and monitoring surfaces
- Back-office views for analytics, earnings, finance, customers, and agro transport workflows

## Product highlights

- Real-time dashboard for active shipments, riders online, revenue today, relay load, and exceptions
- Dispatch breakdown for first-mile, linehaul, destination hub, and final-mile progress
- Terminal load snapshots to spot intake pressure and handoff bottlenecks
- Rider roster with live availability, location context, and assignment status
- Notification queue and ops alert surfaces tied to shipment and delivery events
- Shared routing logic for both local deliveries and cross-state terminal relay journeys

## Stack

- Expo + React Native + Expo Router
- TypeScript
- Supabase Auth, Postgres, and Realtime
- React Native Maps and web map support
- Expo web export support for browser-based operations access

## Project structure

- `app/` app entrypoint
- `components/admin/` admin surfaces such as dashboard, shipments, terminals, riders, and alerts
- `utils/` routing, admin data shaping, and operational helpers
- `migrations/` local schema bootstrap and admin notification setup
- `assets/` application branding and icons

## Local setup

1. Install dependencies.
   ```bash
   npm install
   ```
2. Create a `.env` file in the repo root.
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Apply the local admin migrations in order.
   - `migrations/00_renax_core_setup.sql`
   - `migrations/01_admin_notifications.sql`
   - `migrations/02_fix_shipments_status_check.sql`
   - `migrations/add_is_restricted_to_profiles.sql`
4. Start the app.
   ```bash
   npm run start
   ```

Helpful commands:

```bash
npm run web
npm run ios
npm run android
npm run lint
```

## Backend expectations

This app expects a Supabase project with logistics-focused tables such as `profiles`, `shipments`, `terminals`, `rider_locations`, `shipment_events`, `shipment_stage_proofs`, `shipment_stage_suggestions`, `admin_notifications`, `notification_delivery_queue`, and `ops_alerts`.

## Related RENAX repos

- [RENAX Customer](https://github.com/chimzyfire-ship-it/Renax-Customer)
- [RENAX Rider](https://github.com/chimzyfire-ship-it/Renax-Rider-)

## Summary

RENAX Admin is where RENAX operators manage the network in real time: dispatch decisions, rider visibility, terminal relay flow, notification health, and operational exceptions all come together here.
