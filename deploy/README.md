# Hosting the VFQ DXP review build

1. Build: `npm run build` (output: `dist/`).
2. Copy the CONTENTS of `dist/` to the root of a web host. The app uses absolute paths (`/config/...`, `/mock-data/...`),
   so it must be served from the root of a hostname, not from a sub-path such as `/vfq/`.
3. Make the host fall back to `index.html` for unknown paths (the app uses client-side routing; a refresh on
   `/customer/CUST-1001` must not 404):
   - nginx: `deploy/nginx.conf`
   - IIS: copy `deploy/web.config` next to `index.html`
   - Azure Static Web Apps: copy `deploy/staticwebapp.config.json` next to `index.html` (it requires Microsoft sign-in)
4. Restrict access with the host's own sign-in (SSO) or network rules; the app's login is a demo and is not a security boundary.
