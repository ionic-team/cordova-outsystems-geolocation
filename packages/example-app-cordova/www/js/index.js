/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function logTo(listId, text) {
    const list = document.getElementById(listId);
    const item = document.createElement('li');
    item.textContent = `[${new Date().toISOString()}] ${text}`;
    list.insertBefore(item, list.firstChild);
    console.log(`[${listId}] ${text}`);
}

function formatPosition(prefix, detail) {
    const { timestamp, coords } = detail;
    const field = (label, value) => `\n- ${label}: ${value ?? 'n/a'}`;
    return (
        prefix +
        field('Latitude', coords.latitude) +
        field('Longitude', coords.longitude) +
        field('Accuracy', coords.accuracy) +
        field('Altitude', coords.altitude) +
        field('Altitude accuracy', coords.altitudeAccuracy) +
        field('Heading', coords.heading) +
        field('Speed', coords.speed) +
        field('Magnetic heading', coords.magneticHeading) +
        field('True heading', coords.trueHeading) +
        field('Heading accuracy', coords.headingAccuracy) +
        field('Course', coords.course) +
        field('Time', new Date(timestamp).toISOString())
    );
}

function wireRawButton() {
    const rawButton = document.getElementById('raw-button');

    rawButton.addEventListener('location-grant', (event) => {
        logTo('raw-events-list', `location-grant: granted=${event.detail.granted}`);
    });
    rawButton.addEventListener('location-position', (event) => {
        logTo('raw-events-list', formatPosition('location-position:', event.detail));
    });
    rawButton.addEventListener('location-error', (event) => {
        const { reason, code } = event.detail;
        logTo('raw-events-list', `location-error: ${reason}${code ? ` (code=${code})` : ''}`);
    });
    rawButton.addEventListener('nativeislanderror', (event) => {
        logTo('raw-events-list', `nativeislanderror (permanent fallback): ${event.detail.reason}`);
    });

    document.getElementById('clear-raw-events').addEventListener('click', () => {
        document.getElementById('raw-events-list').innerHTML = '';
    });
}

function wireWrapperButton() {
    window.OSGeolocationWrapper.mountLocationButton(
        'wrapper-button-container',
        { textType: 'use-precise-location' },
        (granted) => logTo('wrapper-events-list', `onGrant: granted=${granted}`),
        (position) => logTo('wrapper-events-list', formatPosition('onPosition:', position)),
        (reason, code) => logTo('wrapper-events-list', `onError: ${reason}${code ? ` (code=${code})` : ''}`),
    );

    document.getElementById('clear-wrapper-events').addEventListener('click', () => {
        document.getElementById('wrapper-events-list').innerHTML = '';
    });
}

function wireRegularApi() {
    document.getElementById('current-location').addEventListener('click', () => {
        const resultElement = document.getElementById('current-location-result');
        window.OSGeolocationWrapper.OSGeolocationInstance.getCurrentPosition(
            (position) => {
                resultElement.textContent = JSON.stringify(position, null, 2);
            },
            (error) => {
                resultElement.textContent = `Error: code=${error.code} message="${error.message}"`;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, enableLocationFallback: true },
        );
    });
}

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');
    document.getElementById('test-ui').style.display = 'block';

    wireRawButton();
    wireWrapperButton();
    wireRegularApi();
}
