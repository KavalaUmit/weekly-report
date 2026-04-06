# IIS Deployment – Weekly Report

This folder contains all files needed to deploy the **Weekly Report** React SPA to IIS.

## Files

| File | Purpose |
|------|---------|
| `web.config` | IIS configuration: SPA routing, MIME types, caching, compression, security headers |
| `deploy.ps1` | PowerShell script to build the app and copy files to the IIS site directory |

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| IIS 8.5+ | Windows Server or Windows 10/11 with IIS feature enabled |
| URL Rewrite Module 2.x | Required for SPA client-side routing – [download](https://www.iis.net/downloads/microsoft/url-rewrite) |
| Node.js 16+ | Needed to run `npm install` and `npm run build` |

## Quick Deployment

Open **PowerShell as Administrator** in the `iis-deploy` folder:

```powershell
# Deploy to the default path (C:\inetpub\wwwroot\weekly-report)
.\deploy.ps1

# Or specify a custom IIS site path
.\deploy.ps1 -SitePath "C:\inetpub\wwwroot\my-site"
```

## Manual Deployment

1. Build the React app from the project root:
   ```powershell
   npm install
   npm run build
   ```
2. Copy everything inside the `build/` folder to your IIS site directory.
3. **Replace** the `web.config` in the site directory with the one from this `iis-deploy/` folder.

## IIS Site Configuration

1. Open **IIS Manager**.
2. Create a new site (or use an existing one) pointing to the deployment directory.
3. Set the **Application Pool** to use **No Managed Code** (the app is purely static).
4. Ensure the **URL Rewrite** module is installed; the `web.config` depends on it.
5. Browse to the site to verify.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 404 on page refresh / deep links | URL Rewrite module missing | Install URL Rewrite 2.x |
| Blank page / JS errors | Wrong site root or missing `index.html` | Verify site path points to build output |
| 500.19 config error | Malformed `web.config` or missing IIS feature | Check Windows Event Log; enable Static Content feature |
| Fonts / icons not loading | MIME type not registered | Already handled in `web.config`; ensure it was not overwritten |
