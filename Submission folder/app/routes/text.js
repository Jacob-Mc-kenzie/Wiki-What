const bk = require('./data.js');
var express = require('express');
var router = express.Router();

//the route for text already saved to the cache or s3
//used so the client can navigate more consistantly.
router.get('/:perma', function (req, res, next) {
    //the generic object that will be returned to the generate html function, 
    //and used to track the state of the app.
    var resJSON = {
        query: null,
        type: "TEXT",
        content: null,
        fromwho: "Wikipedia API"
    };

    //If there is infact somthing in the url
    if (req.params.perma != null) {
        const newstate = req.params.perma;
        resJSON.query = newstate;

        //first check the cache
        bk.data.check_cache(newstate)
            .then((cacheres) => {
                if (cacheres.status == "MISSING") { return bk.data.check_database(newstate); }
                else { return cacheres; }
            })
            .then((dbres) => {
                //then check the database
                if (dbres.status == "OK") {
                    //if it's been found set some state and keep going
                    resJSON.content = dbres.data;
                    resJSON.fromwho = (dbres.message == "REDIS_EXISTS" ? "Redis Cache" : "S3 Bucket");
                }
                else if (dbres.status == "MISSING") {
                    //if it can't be found re-direct
                    res.redirect("/quote");
                }
                else {
                    //other wise set some error state and contiunue
                    resJSON.type = "ERROR";
                    resJSON.content = dbres;
                    resJSON.fromwho = "Unknown";
                }
                return bk.data.generate_html(resJSON)
            })
            .then((page) => {
                //now generate the html and send it to the client.
                console.log("\nLogging, response berfore processing(/id)\n")
                console.log(resJSON);
                res.send(page);
            })
            .catch((e) => {
                //Just in case catch any unhandled errors, then send the info to the client
                resJSON.type = "ERROR";
                resJSON.content = {
                    status: "ERROR",
                    message: "UNKNOWN_STATE-RESTORE_ERROR",
                    detail: "An unknown error has occured, it says: " + e.message,
                    data: e
                };
                resJSON.fromwho = "Unknown";

                bk.data.generate_html(resJSON)
                .then(page =>{
                    res.send(page);
                });
            });
    }
    //if there was no state to be had from the url, redirect
    if (resJSON.query = null) {
        res.redirect("/quote");
    }
});


//now we have the route for getting new state, 
//note the only time the user will stay on this page is in the event of an error.
router.get('/', function (req, res, next) {
    //the generic object that will be returned to the generate html function, 
    //and used to track the state of the app.
    var resJSON = {
        query: null,
        type: "TEXT",
        content: null,
        fromwho: "Wikipedia API"
    };

    //As there is no state yet, generate some using the wiki rest api.
    bk.data.generate_url()
        .then(genres => {
            console.log("\n 1.Url data generated(/):\n")
            console.log(genres);
            //If the response is all good, redirect to the newly generated page.
            if (genres.status == "OK") {
                res.redirect(303, "/quote/" + genres.data);
            }
            //otherwise if the client has already seen this generation, regenerate.
            else if(genres.status == "EXISTS"){
                res.redirect(303, "/quote");
            }
            //finally, since the prior 2 where false, there must be an error.
            else {
                resJSON.type = "ERROR";
                resJSON.content = genres;
                resJSON.fromwho = "Wikipedia API";
            }
        })
        .then(() => {
            //then handel the error and generate a page to tell the client about it.
            bk.data.generate_html(resJSON)
                .then(page => {
                    console.log("\n 2.Logging, response berfore processing(/)\n")
                    console.log(resJSON);
                    res.send(page);
                })

        })
        .catch((e) => {
            //finally handle any un-handled errors.
            resJSON.type = "ERROR";
            resJSON.content = {
                status: "ERROR",
                message: "UNKNOWN_NEW-STATE_ERROR",
                detail: "An unknown error has occured, it says: " + e.message,
                data: e
            };
            resJSON.fromwho = "Unknown";

            //then generate a page and send it to the client
            bk.data.generate_html(resJSON)
                .then(page => {
                    console.log("\nLogging, response berfore processing (/, error)\n")
                    console.log(resJSON);
                    res.send(page);
                })

        });



});


module.exports = router;