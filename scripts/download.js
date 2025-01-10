const utils = require('./utils');

async function downloadOAP(baseURL, pluginName, inEnv, version, auth) {
    let envKey = await utils.getEnvironmentKey(baseURL, inEnv, auth);
    let pluginKey = await utils.getAppKey(baseURL, pluginName, auth);
    let downloadURL = await utils.requestDownloadURL(baseURL, envKey, pluginKey, auth);
        
    let file = await utils.download(downloadURL, auth)
    await utils.save(file, `v${version}.oap`);
}

let pluginSpaceName = process.env.npm_config_plugin;
let baseURL = process.env.npm_config_lifetime;
let auth = process.env.npm_config_authentication;
let environment = process.env.npm_config_environment;
let forgeVersion = process.env.npm_config_forge;

baseURL = `https://${baseURL}/lifetimeapi/rest/v2`;

downloadOAP(baseURL, pluginSpaceName, environment, forgeVersion, auth)