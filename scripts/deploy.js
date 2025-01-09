const utils = require('./utils');
const fs = require("fs");
const { Readable } = require('stream');

async function getLatestTagKey(base, pluginKey, auth){
    let url =  `${base}/applications/${pluginKey}/versions`;
    
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json",
            Authorization: auth
        }
    })
    
    if(response.ok && response.status == 200){
        let list = await response.json();
        return list[0].Key
    }
}

async function createDeploymentPlan(base, toEnv, file, auth) {
    
	let url =  `${base}/environments/${toEnv}/deployment/`
    let data = new Uint8Array(await new Response(file).arrayBuffer());
    let blob = new Blob([data],{type:'application/octet-binary'});
    const response = await fetch(url, {
        method: "POST", 
        headers: {
            Authorization: auth,
            'Content-Type': 'application/octet-stream'
        },
        body:  blob
        
    })
    
    if(response.ok && response.status == 201){
        let key = await response.text()
        return key;
    }
    let error = await response.text();
    throw Error(`Couldn't create a binary deployment, with error: ${error}`)
}

async function startDeployment(base, deployKey, auth){
    let url =  `${base}/deployments/${deployKey}/start`
	
    const response = await fetch(url, {
        method: "POST", 
        headers: {
            "Content-Type": "application/json",
            Authorization: auth
        }
    })
    
    if(response.ok && response.status == 202){ 
        console.log("Deployment Started Successfully 🚀!");   
    }else {
        let res = await response.json();
        console.log(res);
        let url = `${base}/deployments/${deployKey}/status`;
        let status = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: auth
            }
        })
        throw Error (`!! Something while starting the deployment: status is ${status}, with error ${res}`);
    }
}

async function isFinished(base, deployKey, auth) {
    let url = `${base}/deployments/${deployKey}/status`;

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: auth
        }
    })
    
    if(res.ok && res.status == 200){
        let status = await res.json()
        if(status.DeploymentStatus == 'running'){
            console.log("Still running ⏳...");
            return false
        } 
        if(status.DeploymentStatus == 'aborted'){
            throw Error ("!! 🚨 Deployment aborted  🚨!!");
        }
        if(status.DeploymentStatus == 'finished_with_errors'){
            throw Error ("!! 🚨 Something went wrong with the deployment: finished with errors. Please check lifetime !!");
        }

        if(status.DeploymentStatus == 'finished_with_warnings'){
            console.log("🚧 Finished with warnings");
            return true
        }
        if(status.DeploymentStatus == 'finished_successful'){
            console.log("Finished with success 🚀");
            return true
        }
        
    }
    let error = await res.json();
    throw Error ("!! 🚨 Something went wrong with the request: " + error);
}


if(process.env.npm_config_from == null || process.env.npm_config_to == null) {
    throw new Error("Missing repositoryURL, branch, environment arguments");
}

if(process.env.npm_config_authentication == null) {
    throw new Error("Missing authentication argument");
}

let pluginSpaceName = process.env.npm_config_plugin;
let fromEnvironment = process.env.npm_config_from;
let toEnvironment = process.env.npm_config_to;
let basicAuthentication = process.env.npm_config_authentication;
let baseURL = process.env.npm_config_lifetime;

baseURL = `https://${baseURL}/lifetimeapi/rest/v2`;

startDeploy(baseURL, fromEnvironment, toEnvironment, pluginSpaceName, basicAuthentication);

async function startDeploy(baseURL, fromEnvironment, toEnvironment, pluginSpaceName, auth){
   let fromKey = await utils.getEnvironmentKey(baseURL, fromEnvironment, auth);
   let toKey = await utils.getEnvironmentKey(baseURL, toEnvironment, auth);
   console.log(`target key: ${toKey}`);

   let pluginKey = await utils.getAppKey(baseURL, pluginSpaceName, auth);
   console.log(`plugin key: ${pluginKey}`);
   
   let version = await utils.getLatestAppVersion(baseURL, pluginKey, auth);
   console.log(`version to deploy: ${version}`);

   let tagKey = await getLatestTagKey(baseURL, pluginKey, auth);
   console.log(`tagged app key: ${tagKey}`);

   let downloadURL = await utils.requestDownloadURL(baseURL, fromKey, pluginKey, auth);
   let file = await utils.download(downloadURL, auth);

   let deploymentKey = await createDeploymentPlan(baseURL, toKey, file, auth);
   console.log(`deployment key ${deploymentKey}`);

   await startDeployment(baseURL, deploymentKey, auth);
   
   let intervalId = setInterval(async () => {
        let finished = await isFinished(baseURL, deploymentKey, basicAuthentication);
        if(!finished) {
            console.log("Will check again in a while...");
        } else {
            clearInterval(intervalId);
        }
   }, 10000)
}