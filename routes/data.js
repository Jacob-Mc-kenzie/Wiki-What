
const redis = require('redis');
const AWS = require('aws-sdk');
const wikipedia = require('node-wikipedia');
// Cloud Services Set-up

const redisClient = redis.createClient();
const bucketName = 'onebig-darn-incredible-wiki-store';
// Create a promise on S3 service object
const bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();

redisClient.on('error', (err) => {
    console.log("error: " + err);
});

bucketPromise.then(function (data) {
    console.log("Successfully created " + bucketName);
})
    .catch(function (err) {
        console.error(err, err.stack);
    });

export async function check_cache(query){
    const redisKey = `wiki:${query}`;
    return await redisClient.get(redisKey)
    .then((err,res) => {
        if(err){
            return {
                status: "ERROR",
                message: "REDIS_FALT",
                detail: "There was an error when connecting with the redis client.",
                data: err
            }
        }
        else if(res){
            const resJSON = JSON.parse(res);
            return {
                status: "OK",
                message: "REDIS_EXISTS",
                data: resJSON
            }
        }
        return {
            status: "MISSING",
            message: "NOT_IN_REDIS",
            data: null
        }
    })
    .catch(function (e){
        return {
            status: "ERROR",
            message: "CACHE_CHECK_ERROR",
            detail: "Check_cache incountered an unexpected error, "+e.message,
            data: e
        }
    });
} 

export async function check_database(query){
    const s3Key = `wiki-${query}`;
    return await new AWS.S3({ apiVersion: '2006-03-01' }).getObject(params)
    .then(function (err, res) {
        if(err){
            return {
                status: "ERROR",
                message: "S3_GET_ERROR",
                detail: "AWS returned an error when searching for "+query,
                data: err
            }
        }
        else if(res){
            const resJSON = JSON.parse(res);
            redisClient.setex(redisKey, 3600, JSON.stringify({ ...resJSON, }));
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
            detail: "Check_database incountered an unexpected error, "+e.message,
            data: e
        }
    });
}

export async function generate_url(){
    return await {
        message: "dummy"
    }
}

///data with the format
///
// data {
//     query: "endofpageurlhere",
//     type: "TEXT", "IMAGE" or "ERROR",
//     content: theJSONobject_From_wherever,
//     fromwho: "where the data came from"
// }
export async function generate_html(data){
    let page = `<!DOCTYPE html>
    <html>
    <head>
        <title>Wiki-What`+ (data.type == "TEXT"? `-teeeext`: data.type == "IMAGE"? `-imaaaaage`:`-Error`)+`</title>
        <link rel="stylesheet" type="text/css" href="stylesheets/style.css">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="utf-8">
        <link rel="icon" href="favicon.png">
        <meta name="theme-color" content="#212121">
    </head><body>`;

    let url = (data.type == "TEXT"? "/quote?perma="+data.query: "/image?perma="+data.query);

    page = page + "<h1>Tempory page, type: "+ data.type+"</h1>\n"+
                  "<p>"+JSON.stringify(data.content)+"</p>"+
                  "<a href=\""+url+"\"><p>This is a permalink</p></a>"+
                  "<h4>from "+data.fromwho+"</h4> </body></html>";
    return page;
}