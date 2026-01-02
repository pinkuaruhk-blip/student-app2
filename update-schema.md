# Schema Update Instructions

The application needs a `system_settings` table to store default email configuration.

## Manual Update via InstantDB Dashboard

1. Go to: https://instantdb.com/dash?s=main&t=explorer&app=f0827431-76de-4f51-a2c3-bae2e1558bcc

2. Click on the **"Schema"** tab

3. Find the `entities` section and verify that `system_settings` is included:

```typescript
system_settings: i.entity({
  defaultFromEmail: i.string().optional(),
  defaultFromName: i.string().optional(),
}),
```

4. If it's not there, your schema in `instant.schema.ts` already has it defined correctly, so you just need to:
   - Click the **"Push Schema"** button in the dashboard, OR
   - Copy the entire content from `instant.schema.ts` and paste it into the schema editor

5. Click **"Apply"** or **"Update"** to push the schema changes

## Verify

After updating, refresh your application settings page at:
http://localhost:3000/settings

The email settings section should now work without errors!

## Note

The schema file at `instant.schema.ts` already contains the correct definition. You just need to push it to InstantDB's servers via the dashboard.
