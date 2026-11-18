# Wrapper for Outsystems Geolocation Plugin

This a simple wrapper of the Geolocation Plugin, either cordova or capacitor, that adds extra time out logic to the `getCurrentPosition` feature. Currently, it is being used by the OutSystems Wrapper.


## Outsystems' Usage
1. Run npm build
```console
npm run build
```
2. Copy the resulting `./dist/outsystems.js` file to the plugin's scripts folder
3. Call the `RequireScript` client action, with the script's url
4. Call `OSGeolocationWrapper.OSGeolocationInstance.<method>`

## Location Button

Use `mountLocationButton` to mount the component. UI Blocks can update and destroy it
by Container ID with `updateLocationButtonInContainer` and
`destroyLocationButtonInContainer`. The wrapper forwards grant, position, and error
events to the supplied callbacks.

Appearance options set ordinary CSS properties on the custom element. When
`backgroundColor` is empty or isn't a valid CSS color (`CSS.supports('color', value)`),
the wrapper uses the app's primary color from the design system instead, resolved by the
browser on the element in this order: the background primary variables
`--token-bg-primary-base-default` (Mobile UI) and `--background-color-primary`
(OutSystems UI), then the regular primary variables `--token-semantics-primary-base`
(Mobile UI) and `--color-primary` (OutSystems UI), and finally `#105CEF`. If the property
isn't passed at all, the element keeps its own default (`#0B57D0`). Style classes
can customize the same properties directly:

```css
os-location-button {
  background-color: #0b57d0;
  color: #ffffff;
  --os-location-button-icon-color: #ffffff;
  border-color: #000000;
  border-width: 1px;
  border-radius: 16px;
  z-index: 2;
}
```
