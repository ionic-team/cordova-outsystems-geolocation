# OSGeolocationPlugin Build Actions

This plugin requires location permissions in `AndroidManifest.xml`. The build action controls which permissions are declared based on the accuracy tier the consuming app needs.

## What this configures

### Android

| Action | Purpose |
|--------|---------|
| `manifest` merge | Adds `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` unconditionally |
| `manifest` delete | Removes `ACCESS_FINE_LOCATION` when `LOCATION_PERMISSION_TYPE` is `APPROXIMATE` or `NONE` |
| `manifest` delete | Removes `ACCESS_COARSE_LOCATION` when `LOCATION_PERMISSION_TYPE` is `NONE` |

## Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `LOCATION_PERMISSION_TYPE` | string | no | `PRECISE` | Controls which location permissions are declared in the manifest. Both permissions are added unconditionally and then pruned based on this value: `PRECISE` keeps both, `APPROXIMATE` removes `ACCESS_FINE_LOCATION`, `NONE` removes both. Unset or empty string behaves as `PRECISE`. Values are case-sensitive. |

## ODC Setup

1. In ODC Studio, add `buildAction.json` as a resource and set **Deploy Action**
   to **Deploy to Target Directory**.
2. Configure extensibility to reference the file and resolve its variables.
   The path depends on the target:
   - **ODC app:** App > Edit app properties > Extensibility
   - **ODC Mobile Library (plugin):** Library > Edit library properties > Extensibility

   ```json
   {
       "buildConfigurations": {
           "buildAction": {
               "config": "$resources.buildAction.json",
               "parameters": {
                   "LOCATION_PERMISSION_TYPE": "PRECISE"
               }
           }
       }
   }
   ```

   Values in `parameters` can be hardcoded literals or extensibility setting references
   (`$extensibilitySettings.SettingName`). Use extensibility settings if consuming apps
   should be able to choose the accuracy tier. The plugin developer creates the settings
   in ODC Studio: right-click **Extensibility Settings** in the context pane →
   **Add Extensibility Setting**. The consuming app then sets values in ODC Portal →
   app → **Mobile distribution** → **Extensibility settings**.

3. Build in the ODC Portal using MABS 12 or greater:
   - **ODC app:** build the app directly.
   - **ODC Mobile Library (plugin):** consume the library in an ODC app, then
     build that app.
