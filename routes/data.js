
var redis = require('promise-redis')();
const AWS = require('aws-sdk');
const axios = require('axios');
// Cloud Services Set-up

const redisClient = redis.createClient({});
const bucketName = 'onebig-darn-incredible-wiki-store';
// Create a promise on S3 service object

const bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();

// redisClient.on('error', (err) => {
//     console.log("error: " + err);
// });

bucketPromise.then(function (data) {
    console.log("Successfully created " + bucketName);
})
    .catch(function (err) {
        console.error(err, err.stack);
    });


var methods = {};

methods.check_cache = async function check_cache(query) {
    const redisKey = `wiki:${query}`;
    try {
        return await redisClient.get(redisKey)
        .then((res) => {
            if (res != null) {
                const resJSON = JSON.parse(res);
                return {
                    status: "OK",
                    message: "REDIS_EXISTS",
                    data: resJSON
                }
            }
            else {
                return {
                    status: "MISSING",
                    message: "NOT_IN_REDIS",
                    data: null
                }
            }
        })
        .catch((e)=>{
            return {
                status: "ERROR",
                message: "CACHE_CHECK_ERROR",
                detail: "Check_cache incountered an unexpected error, " + e.message,
                data: e
            }
        });
    }
    catch (e) {
        return {
            status: "ERROR",
            message: "CACHE_CHECK_ERROR",
            detail: "Check_cache incountered an unexpected error, " + e.message,
            data: e
        }
    };
}

methods.check_database = async function check_database(query) {
    const s3Key = `wiki-${query}`;
    const redisKey = `wiki:${query}`;
    const params = { Bucket: bucketName, Key: s3Key };
    return await new AWS.S3({ apiVersion: '2006-03-01' }).getObject(params)
        .then(function (err, res) {
            if (err) {
                return {
                    status: "ERROR",
                    message: "S3_GET_ERROR",
                    detail: "AWS returned an error when searching for " + query,
                    data: err
                }
            }
            else if (res) {
                const resJSON = JSON.parse(res);
                redisClient.setex(redisKey, 3600, JSON.stringify(resJSON));
                return {
                    status: "OK",
                    message: "S3_EXISTS",
                    data: resJSON
                }
            }
            return {
                status: "MISSING",
                message: "NOT_IN_S3",
                detail: "Queried item was not found in the database.",
                data: null
            }
        })
        .catch(function (e) {
            return {
                status: "ERROR",
                message: "S3_PROMISE_ERROR",
                detail: "Check_database incountered an unexpected error, " + e.message,
                data: e
            }
        });
}

methods.generate_url = async function generate_url() {

    return await axios.get("https://en.wikipedia.org/api/rest_v1/page/random/summary")
        .then(resp => {
            console.log("\nAxios response\n");
            console.log(resp);
            if (resp.status == 200) {
                const data = {
                    url: resp.data.content_urls.desktop.page,
                    title: resp.data.title,
                    thumbnail: resp.data.thumbnail.source,
                    extract_html: resp.data.extract_html
                };
                console.log("\nUploading Data: \n");
                console.log(data);
                const query = hashcode(resp.data.titles.canonical);
                const s3Key = `wiki-${query}`;
                const redisKey = `wiki:${query}`;
                redisClient.setex(redisKey, 3600, JSON.stringify(data));
                const body = JSON.stringify(data);
                const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };
                const uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
                uploadPromise.then(function (d) {
                    console.log("Successfully uploaded data to " + bucketName + "/" + s3Key);

                })
                return {
                    status: "OK",
                    message: "AWAITING_RE-DIRECT",
                    detail: "state has been saved, sending new url now.",
                    data: query
                }
            }
            else {
                return {
                    status: "ERROR",
                    message: "AXIOS_ERROR",
                    detail: "There was an error when generating the wiki url.",
                    data: resp
                }
            }
        })
        .catch(e => {
            return {
                status: "ERROR",
                message: "PROMISE_AXIOS_ERROR",
                detail: "an unexpected error occured when generating the wiki url, " + e.message,
                data: e
            }
        });

}

///data with the format
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
methods.generate_html = async function generate_html(data) {
    let page = `<!DOCTYPE html>
    <html>
    <head>
        <title>Wiki-What`+ (data.type == "TEXT" ? `-teeeext` : data.type == "IMAGE" ? `-imaaaaage` : `-Error`) + `</title>
        <link rel="stylesheet" type="text/css" href="stylesheets/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="utf-8">
        <link rel="icon" href="favicon.png">
        <meta name="theme-color" content="#212121">
    </head><body><div class="box">`;
    try {
        var url;
        page = page + "<h1>Tempory page, type: " + data.type + "</h1>\n";
        if(data.type == "ERROR"){
            url = "/";
            page = page + `<h1> Error </h1>
                           <h3>`+data.message+`</h3>
                           <h4>That's an error</h4>
                           <p>`+data.detail+`</p>
                           <a href="/"><p>Try again?</p></a>
                           `;
        }
        else{
            url = (data.type == "TEXT"? "/quote/": "/image/") + data.query;
            if(data.type == "TEXT"){
                page = page + `<h1>Tempory page</h1>
                               <h2>`+data.content.title+`</h2>
                               `+data.content.extract_html+`
                               <a href="`+url+`"><p>This is a permalink</p></a>`;
            }
            else{

            }
        }

        page = page + 
            "<br/><h4>from " + data.fromwho + "</h4> </div></body></html>";
    }
    catch (e) {
        page = page + "<h1>Tempory page, type: ERROR</h1>\n" +
            "<p>" + e.message + "</p>" +
            "<p>" + e + "</p>" +
            "<h4>from " + data.fromwho + "</h4> </body></html>";
    }
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

exports.data = methods;