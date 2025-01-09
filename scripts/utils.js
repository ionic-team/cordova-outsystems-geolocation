const fs = require("fs");
const { finished } = require('stream/promises');
const { Readable } = require('stream');
const path = require("path");

const DOWNLOAD_FOLDER = "downloads";

async function getEnvironmentKey(base, env, auth){
    let url =  `${base}/environments`;
    
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json",
            Authorization: auth
        }
    })

    if(response.ok && response.status == 200){
        let list = await response.json();
        return (list.filter((detail) => detail.Name == env)[0]).Key;
    }

    
    let error  = await response.text();
    console.error(error);
    throw Error("Couldn't get environment key. Please check logs for more info.");
}

async function getAppKey(base, pluginSpaceName, auth){
    let url =  `${base}/applications?IncludeEnvStatus=true`;
    
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: auth
        }
    });
    
    if(response.ok && response.status == 200){
        let list = await response.json();
        let app = list.filter((a) => a.Name == pluginSpaceName)[0];
        return app.Key
    }

    let error = response.text();
    console.error(error);
    throw Error("Couldn't retrieve app key. :(");
}

async function getLatestAppVersion(base, appKey, auth) {
    let url =  `${base}/applications/${appKey}/versions`;
    
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: auth
        }
    });

    if(response.ok && response.status == 200){
        let list = await response.json();
        
        if(list.length > 0)
            return list[0].Version;
        return '1.0.0';
    }

    let res = await response.text();
    console.error(res);
    throw Error ("Couldn't retrive app tag version.");
}

async function download(url, auth) {

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: auth
        }
    })

    if(!response.ok || response.status != 200) {
      let error = await response.text();
      console.error(error);
      throw Error("Couldn't download file :(((.")
    }
    let file =  response.body;

    return file;
}

async function save(file, fileName) {
    if (!fs.existsSync(DOWNLOAD_FOLDER)){
		console.log("Create downloads folder: " + DOWNLOAD_FOLDER);
		fs.mkdirSync(DOWNLOAD_FOLDER);
	}
    
    const destination = path.resolve(`./${DOWNLOAD_FOLDER}/${fileName}`);
    const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
    await finished(Readable.fromWeb(file).pipe(fileStream));
    console.log(`Finifhed writing to ${destination}`);
}

async function requestDownloadURL(baseURL, envKey, pluginKey, auth) {
    let downloadEndpoint = `${baseURL}/environments/${envKey}/applications/${pluginKey}/content`
    const response = await fetch(downloadEndpoint, {
        method: 'GET',
        headers: {
            Authorization: auth
        }
    })
    if(response.ok && response.status == 200){
        let downloadInfo = await response.json()
        return downloadInfo.url
    } 

    let error = await response.text();
    throw Error(`Couldn't get download url, because of ${error}`);
}

module.exports = {
    getAppKey,
    getEnvironmentKey,
    getLatestAppVersion,
    download,
    requestDownloadURL,
    save
}