const fs = require('fs');
const path = require('path');

const PRECISE = 'PRECISE';
const APPROXIMATE = 'APPROXIMATE';
const NONE = 'NONE';
const ONLY_FOR_LOCATION_BUTTON = 'ONLY_FOR_LOCATION_BUTTON';
const FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE_LOCATION = 'android.permission.ACCESS_COARSE_LOCATION';

module.exports = function(context) {
    const pluginRoot = context.opts.plugin ? context.opts.plugin.dir : path.join(__dirname, '..');
    const { ConfigParser } = requireFromPlugin(pluginRoot, 'cordova-common');
    const { DOMParser, XMLSerializer } = requireFromPlugin(pluginRoot, '@xmldom/xmldom');
    const projectRoot = context.opts.cordova.project ? context.opts.cordova.project.root : context.opts.projectRoot;
    const configXML = path.join(projectRoot, 'config.xml');
    const configParser = new ConfigParser(configXML);

    let locationPermissionType = configParser.getPlatformPreference('LOCATION_PERMISSION_TYPE', 'android');

    if (![PRECISE, APPROXIMATE, NONE, ONLY_FOR_LOCATION_BUTTON].includes(locationPermissionType)) {
        locationPermissionType = PRECISE;
    }

    if (locationPermissionType === NONE) {
        // Returning without writing to the manifest is sufficient — this plugin no longer declares
        // permissions statically, so nothing needs to be removed.
        return;
    }

    const manifestFilePath = path.join(projectRoot, 'platforms/android/app/src/main/AndroidManifest.xml');
    const manifestXmlString = fs.readFileSync(manifestFilePath, 'utf-8');

    const parser = new DOMParser();
    const manifestXmlDoc = parser.parseFromString(manifestXmlString, 'text/xml');

    if (locationPermissionType === PRECISE) {
        addPermissionToManifest(manifestXmlDoc, FINE_LOCATION);
    } else if (locationPermissionType === ONLY_FOR_LOCATION_BUTTON) {
        // On Android 17 and later, precise location is then granted only through the location button.
        addPermissionToManifest(manifestXmlDoc, FINE_LOCATION, 'onlyForLocationButton');
    }
    addPermissionToManifest(manifestXmlDoc, COARSE_LOCATION);

    const serializer = new XMLSerializer();
    const updatedManifestXmlString = serializer.serializeToString(manifestXmlDoc);
    fs.writeFileSync(manifestFilePath, updatedManifestXmlString, 'utf-8');
};

function requireFromPlugin(pluginRoot, moduleId) {
    return require(require.resolve(moduleId, { paths: [pluginRoot] }));
}

function addPermissionToManifest(manifestXmlDoc, permission, usesPermissionFlags) {
    const existingPermissions = Array.from(manifestXmlDoc.getElementsByTagName('uses-permission'));
    let element = existingPermissions.find(el => el.getAttribute('android:name') === permission);

    if (!element) {
        element = manifestXmlDoc.createElement('uses-permission');
        element.setAttribute('android:name', permission);
        manifestXmlDoc.documentElement.appendChild(element);
    }
    if (usesPermissionFlags) {
        element.setAttribute('android:usesPermissionFlags', usesPermissionFlags);
    }
}
