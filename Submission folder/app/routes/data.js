
var redis = require('promise-redis')();
const AWS = require('aws-sdk');
const axios = require('axios');
// Cloud Services Set-up

const redisClient = redis.createClient({});
const bucketName = 'onebig-darn-incredible-wiki-store';

// Create a promise on S3 service object
const bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();


//do the promise
bucketPromise.then(function (data) {
    console.log("Successfully created " + bucketName);
    console.log(data);
})
    .catch(function (err) {
        //catch the errors form the promise
        console.error(err, err.stack);
    });

//initise the object to hold the methosd to be exported
var methods = {};

//checks the cache for the queried paramater
methods.check_cache = async function check_cache(query) {
    const redisKey = `wiki:${query}`;
    try {
        return await redisClient.get(redisKey)
        .then((res) => {
            if (res != null) {
                //if the data exists return it
                const resJSON = JSON.parse(res);
                return {
                    status: "OK",
                    message: "REDIS_EXISTS",
                    data: resJSON
                }
            }
            else {
                return {
                    //otherwise it must be missing
                    status: "MISSING",
                    message: "NOT_IN_REDIS",
                    data: null
                }
            }
        })
        .catch((e)=>{
            //catch any errors
            return {
                status: "ERROR",
                message: "CACHE_CHECK_ERROR",
                detail: "Check_cache incountered an unexpected error, " + e.message,
                data: e
            }
        });
    }
    catch (e) {
        //catch any un-handled errors
        return {
            status: "ERROR",
            message: "CACHE_CHECK_ERROR",
            detail: "Check_cache incountered an unexpected error, " + e.message,
            data: e
        }
    };
}

//checks the s3 bucket for the quired item
methods.check_database = async function check_database(query) {
    const s3Key = `wiki-${query}`;
    const redisKey = `wiki:${query}`;
    const params = { Bucket: bucketName, Key: s3Key };
    try {
        //use the promise supported getobject helper to get the item
        return await getObject(params)
        .then(function (data) {
            //if its there, decode, parse and cache, before returning to the client
            const objectData = data.Body.toString('utf-8');
            const resJSON = JSON.parse(objectData);
            redisClient.setex(redisKey, 3600, JSON.stringify(resJSON));
            console.log(resJSON);
                return {
                    status: "OK",
                    message: "S3_EXISTS",
                    data: resJSON
                }
        })
        .catch(e =>{
            //otherwise catch errors
            if(e.code == "NoSuchKey"){
                //if the data wasen't in s3 say so.
                return {
                    status: "MISSING",
                    message: "NOT_FOUND_IN_S3",
                    detail: "The spesified key "+query+" could not be found",
                    data: e
                }
            }
            return {
                //otherwise return an error
                status: "ERROR",
                message: "S3_GET_ERROR",
                detail: "AWS returned an error when searching for " + query,
                data: e
            }
        });
    }
    catch(e){
        //and of cource catch any unexpected errors.
        return {
            status: "ERROR",
            message: "S3_PROMISE_ERROR",
            detail: "Check_database incountered an unexpected error, " + e.message,
            data: e
        }
    }
}
//generates some new state and stores it in the cache and s3, then gives the new url to go to.
methods.generate_url = async function generate_url() {
    //get a random artical using the wikipedia rest api.
    return await axios.get("https://en.wikipedia.org/api/rest_v1/page/random/summary")
        .then(resp => {
            console.log("\nAxios response\n");
            console.log(resp);
            //if the request worked, then structure the data.
            if (resp.status == 200) {
                const data = {
                    url: resp.data.content_urls.desktop.page,
                    title: resp.data.title,
                    thumbnail: resp.data.thumbnail.source,
                    extract_html: resp.data.extract_html
                };
                
                console.log("\nUploading Data: \n");
                console.log(data);
                //get a unique key using a hash helper function
                const query = hashcode(resp.data.titles.canonical);
                //check to see if the user has already seen this item.
                if(this.check_cache(query).status == "OK"){
                    return{
                        status: "EXISTS",
                        message: "ALREADY_SEEN",
                        detail: "the generated data has already been seen",
                        data: resp
                    }
                }
                //if they haven't upload to redis and s3
                const s3Key = `wiki-${query}`;
                const redisKey = `wiki:${query}`;
                redisClient.setex(redisKey, 3600, JSON.stringify(data));
                const body = JSON.stringify(data);
                const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };
                const uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
                uploadPromise.then(function (d) {
                    console.log("Successfully uploaded data to " + bucketName + "/" + s3Key);

                })
                //then return a sucess.
                return {
                    status: "OK",
                    message: "AWAITING_RE-DIRECT",
                    detail: "state has been saved, sending new url now.",
                    data: query
                }
            }
            else {
                //otherwise return an error.
                return {
                    status: "ERROR",
                    message: "AXIOS_ERROR",
                    detail: "There was an error when generating the wiki url.",
                    data: resp
                }
            }
        })
        .catch(e => {
            //or return an unexpected error
            return {
                status: "ERROR",
                message: "PROMISE_AXIOS_ERROR",
                detail: "an unexpected error occured when generating the wiki url, " + e.message,
                data: e
            }
        });

}

///input data with the format
///
// data {
//     query: "endofpageurlhere",
//     type: "TEXT", "IMAGE" or "ERROR",
//     content: {
//      status: "ERROR",
//      message: "UNKNOWN_STATE-RESTORE_ERROR",
//      detail: "An unknown error has occured, it says: " + e.message,
//      content: either an error or {
//         url:,
//         title:,
//         thumbnail:
//         extract_html:
//          }
//      }
//     fromwho: "where the data came from"
// }
//returns a string of the pages html.
methods.generate_html = async function generate_html(data) {

    //first create a generic header.
    let page = `<!DOCTYPE html>
    <head>
        <title>Wiki-What</title>
        <link rel="stylesheet" type="text/css" href="../stylesheets/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="utf-8">
        <link rel="icon" href="../favicon.png">
        <meta name="theme-color" content="#212121">
    </head>
    <body>
    <a href="/" style="text-decoration: none"><h1 class="title">WIKI-WHAT</h1></a>
        <div class="box">`;

    try {
        // generate an error page
        if(data.type == "ERROR"){
            url = "/";
            page = page + `<h1 > Error </h1>
                           <h3style="color:#ba3b3b;">${data.content.message}</h3>
                           <h4>That's an error</h4>
                           <p>${data.content.detail}</p>
                           <a href="/"><p>Try again?</p></a>
                           `;
        }
        
        else{
            url = (data.type == "TEXT"? "/quote/": "/image/") + data.query;
            // generate a text page
            if(data.type == "TEXT"){
                page = page + 
                `
                <h1>${data.content.title}</h1>
                <h2 id="text">${data.content.extract_html}</h2>
                <a href="/quote"><h1>Generate another</h1></a>
                </div>`;
            }
            // generate an image page
            else{
                page = page + 
                `
                <a class="center" href="${data.content.url}"><img src="${data.content.thumbnail}"/></a><br />
                <a href="/image"><h1>Generate another</h1></a>
                </div>`;
            }
        }
        // generate a generic footer.
        page = page + 
            `<br/><h4>from ${data.fromwho}</h4> </div></body></html>`;
    }
    // error
    catch (e) {
        //catch any unexpected errors
        page = page + "<h1>Tempory page, type: ERROR</h1>\n" +
            "<p>" + e.message + "</p>" +
            "<p>" + e + "</p>" +
            "<h4>from " + data.fromwho + "</h4> </body></html>";
    }
    //return the new page
    return page;
}

///Helper functions

//from https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
function hashcode(s) {
    var hash = 0;
    if (s.length == 0) {
        return hash;
    }
    for (var i = 0; i < s.length; i++) {
        var char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}


function getObject(key) {
    return new Promise((resolve, reject) => {
        new AWS.S3({ apiVersion: '2006-03-01' }).getObject({
            Bucket: key.Bucket,
            Key: key.Key
        }, (err, data) => {
            if ( err ) reject(err)
            else resolve(data)
        })
    })
}

exports.data = methods;