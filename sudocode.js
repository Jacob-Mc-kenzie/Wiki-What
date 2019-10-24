
//the page being requested
user.request("/", (req, response) => {

    //make a variable to stor the data to display, and who it came from
    var wikiJSON;
    let fromwho = "WikipediaAPI";

    //check to see if theres any state in the url.
    if (query.params.perma != null) {
        const newstate = query.perams.perma;
        //first see if its in the cache
        check_cache(newstate, (re) => {
            if (re.message == "OK") {
                // exists
                wikiJSON = re.data;
                fromwho = "Reids cache";
            }
            else if (message == "ERROR") {
                // error handling
                return pagewithanerror;
            }
            else {
                // then the databzse
                check_database(newstate, (re) => {
                    if (re.message == "MISSING") {
                        wikiJSON = re.data;
                        fromwho = "S3 database";
                    }
                    else if (message == "ERROR") {
                        return pagewithanerror;
                    }
                });
            }
        });
    }
    //if there was no state to load generate some.
    if (wikiJSON == null) {
        generate_wiki_page( (re)=>{
            if(re.message == "OK WIKI"){
                wikiJSON = re.data;
            }
            else if(re.message == "OK DATABASE"){
                wikiJSON = re.data;
                fromwho = "S3 Database"
            }
            else{
                return pagewithanerror;
            }
        });
    }
    //now that theres a page with data, generate the html.
    let pageHTML = generate_html(wikiJSON, fromwho);
    return response.status(200).body(pageHTML);

});

function check_cache(key) {
    //check the cashe for a data entry matching the key
    return redisClient.get(key, (err, res) => {
        //check for error
        if (err) {
            //handle error
            return {
                message: "ERROR",
                data: err
            }
        }
        //check for cache
        if (res) {
            //show cache
            const resultJSON = JSON.parse(res);
            return {
                message: "OK",
                data: resultJSON.body
            }
        }
        //otherwise it's not there
        else {
            return {
                message: "MISSING",
                data: null
            }
        }
    });
}

function check_database(key) {
    //check thedatabase for a data entry matching the key
    return new AWS.S3({ apiVersion: '2006-03-01' }).getObject(key, (err, result) => {
        //check for error
        if (err) {
            //handle error
            return {
                message: "ERROR",
                data: err
            }
        }
        //check for database storage
        if (result) {
            // Serve from S3
            const resultJSON = JSON.parse(result.Body);
            //save to the cache
            redisClient.setex(redisKey, 3600, JSON.stringify({ source: 'Redis Cache', body: resultJSON, }));
            return {
                message: "OK",
                data: resultJSON
            }
        }
        //otherwise it's not there
        else {
            return {
                message: "MISSING",
                data: null
            }
        }
    });
}

function generate_wiki_page() {
    //do somthing that generates a url

    var wikiurl;
    let urlunique = false;

    try {
        // check if unique
        while (!urlunique) {
            //generate url
            ///
            ///  code here.
            ///
            
            if (wikiurl in cache) {
                // skip if in the cache
                continue;
            }

            if(wikiurl in database){
                // return if in the database
                return {
                    message: "OK DATABASE",
                    data: check_database(wikiurl)
                }
            }
            return {
                // get from API
                message: "OK WIKI",
                data: wikiapi.get(wikiurl)
            }
        }
    }
    catch (e) {
        return {
            message: "ERROR",
            data: e
        }
    }
}

function generate_html(wikidata, who){
    //html generating code here
    var page = "<html><head><title>wow this is dummy code</title></head><body>";
    //DO SOME STUFF
    page = page + "<p> data searved from "+who+"</p></body></html>";
    return page;
}