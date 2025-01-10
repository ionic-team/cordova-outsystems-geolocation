const utils = require('./utils')

async function getModules(base, pluginKey, inEnv, auth){
    let url =  `${base}/environments/${inEnv}/applications/${pluginKey}?IncludeEnvStatus=true&IncludeModules=true`;
    
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: auth
        }
    })
    
    if(response.ok && response.status == 200){
        let app = await response.json();
        return app.AppStatusInEnvs[0].ModuleStatusInEnvs.map((m) => m.ModuleVersionKey )
    }
}

async function createVersion(base, appKey, inEnv, version, modules, auth){
    let url =  `${base}/environments/${inEnv}/applications/${appKey}/versions`;
    let body = {
        ChangeLog: "New version created by github action",
        Version: version,
        MobileVersions: [],
        ModuleVersionKeys: modules
        
    }
    let response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: auth
        },
        body: JSON.stringify(body)
    })

    if(response.ok && response.status == 201){
       let res = await response.json();
       return res.ApplicationVersionKey;
    } 
    
    console.log(response.status)
    let answer  = await response.text()
    console.log(answer)
    throw Error("Coulnd't tag application.")


}

async function tagApp(baseURL, pluginSpaceName, auth){
    let fromKey = await utils.getEnvironmentKey(baseURL, "Development", auth);
    let pluginKey = await utils.getAppKey(baseURL, pluginSpaceName, auth);
    console.log(`plugin key: ${pluginKey}`);

    let modules = await getModules(baseURL, pluginKey, fromKey, auth);
    console.log(modules)

    let version = await utils.getLatestAppVersion(baseURL,pluginKey, auth);
    console.log(`last tagged version: ${version}`);

    let [_, major, minor, patch] = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/) ?? []; 
    let newVersion = `${major}.${minor}.${parseInt(patch) + 1}`;
    console.log(`next version: ${newVersion}`);
    
    let appKey = await createVersion(baseURL, pluginKey, fromKey, newVersion, modules, auth);
    console.log(`new plugin version tag created, app key is ${appKey}`)
}



if(process.env.npm_config_authentication == null) {
    throw new Error("Missing authentication argument");
}

let pluginSpaceName = process.env.npm_config_plugin;
let authentication = process.env.npm_config_authentication;
let baseURL = process.env.npm_config_lifetime;

baseURL = `https://${baseURL}/lifetimeapi/rest/v2`;

tagApp(baseURL, pluginSpaceName, authentication);


