const fs = require('fs');
const path = require('path');
const { ConfigParser } = require('cordova-common');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const PRECISE = 'PRECISE';
const APPROXIMATE = 'APPROXIMATE';
const NONE = 'NONE';
const FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE_LOCATION = 'android.permission.ACCESS_COARSE_LOCATION';

module.exports = function(context) {
    const projectRoot = context.opts.cordova.project ? context.opts.cordova.project.root : context.opts.projectRoot;
    const configXML = path.join(projectRoot, 'config.xml');
    const configParser = new ConfigParser(configXML);

    let locationPermissionType = configParser.getPlatformPreference('LOCATION_PERMISSION_TYPE', 'android');

    if (locationPermissionType !== PRECISE && locationPermissionType !== APPROXIMATE && locationPermissionType !== NONE) {
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
    }
    addPermissionToManifest(manifestXmlDoc, COARSE_LOCATION);

    const serializer = new XMLSerializer();
    const updatedManifestXmlString = serializer.serializeToString(manifestXmlDoc);
    fs.writeFileSync(manifestFilePath, updatedManifestXmlString, 'utf-8');
};

function addPermissionToManifest(manifestXmlDoc, permission) {
    const existingPermissions = Array.from(manifestXmlDoc.getElementsByTagName('uses-permission'));
    const alreadyExists = existingPermissions.some(el => el.getAttribute('android:name') === permission);

    if (!alreadyExists) {
        const newPermission = manifestXmlDoc.createElement('uses-permission');
        newPermission.setAttribute('android:name', permission);
        manifestXmlDoc.documentElement.appendChild(newPermission);
    }
}
