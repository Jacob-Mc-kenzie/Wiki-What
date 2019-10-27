const bk = require('./data.js');
var express = require('express');
var router = express.Router();

//the route for image already saved to the cache or s3
//used so the client can navigate more consistantly.
router.get('/:perma', function (req, res, next) {
    //the generic object that will be returned to the generate html function, 
    //and used to track the state of the app.
    var resJSON = {
        query: null,
        type: "IMAGE",
        content: null,
        fromwho: "Wikipedia API"
    };

    //if there is state in the url, then we can get started.
    if (req.params.perma != null) {
        const newstate = req.params.perma;
        resJSON.query = newstate;

        //first check the cache.
        bk.data.check_cache(newstate)
            .then((cacheres) => {
                if (cacheres.status == "MISSING") { return bk.data.check_database(newstate); }
                else { return cacheres; }
            })
            .then((dbres) => {
                //then check the database
                if (dbres.status == "OK") {
                    //if the item was found in the cache or s3, great, set some state and continue
                    resJSON.content = dbres.data;
                    resJSON.fromwho = (dbres.message == "REDIS_EXISTS" ? "Redis Cache" : "S3 Bucket");
                }
                else if (dbres.status == "MISSING") {
                    //if the item was missing, redirect to generate some new state.
                    res.redirect("/image");
                }
                else {
                    //otherwise catch some errors
                    resJSON.type = "ERROR";
                    resJSON.content = dbres;
                    resJSON.fromwho = "Unknown";
                }
                //and generate some html
                return bk.data.generate_html(resJSON)
            })
            .then((page) => {
                //then with the generated html, send it off to the client.
                console.log("\nLogging, response berfore processing(/id)\n")
                console.log(resJSON);
                res.send(page);
            })
            .catch((e) => {
                //finally catch any unexpected errors, and generate apropriate html.
                resJSON.type = "ERROR";
                resJSON.content = {
                    status: "ERROR",
                    message: "UNKNOWN_STATE-RESTORE_ERROR",
                    detail: "An unknown error has occured, it says: " + e.message,
                    data: e
                };
                resJSON.fromwho = "Unknown";
                //then send to the client
                bk.data.generate_html(resJSON)
                .then(page =>{
                    res.send(page);
                });
            });
    }
    // if there was no url state at the start, then redirect
    if (resJSON.query = null) {
        res.redirect("/image");
    }
});

//now we have the route for getting new state, 
//note the only time the user will stay on this page is in the event of an error.
router.get('/', function (req, res, next) {

    //first the state object.
    var resJSON = {
        query: null,
        type: "IMAGE",
        content: null,
        fromwho: "Wikipedia API"
    };

    //then new state generation, returns an object with the format
    //         {
    //         url:,
    //         title:,
    //         thumbnail:
    //         extract_html:
    //          }
    bk.data.generate_url()
        .then(genres => {
            console.log("\n 1.Url data generated(/):\n")
            console.log(genres);
            if (genres.status == "OK") {
                // if it's all good redirect to the freshly made page.
                res.redirect(303, "/image/" + genres.data);
            }
            else if(genres.status == "EXISTS"){
                // but if its been seen then quickly scram to a new page and try again.
                res.redirect(303, "/image");
            }
            else {
                //handle errors.
                resJSON.type = "ERROR";
                resJSON.content = genres;
                resJSON.fromwho = "Wikipedia API";
            }
        })
        .then(() => {
            //generate html for the error
            bk.data.generate_html(resJSON)
                .then(page => {
                    //send a response.
                    console.log("\n 2.Logging, response berfore processing(/)\n")
                    console.log(resJSON);
                    res.send(page);
                })

        })
        .catch((e) => {
            //catch any unexpected errors, and ssend the apropriate message to the client.
            resJSON.type = "ERROR";
            resJSON.content = {
                status: "ERROR",
                message: "UNKNOWN_NEW-STATE_ERROR",
                detail: "An unknown error has occured, it says: " + e.message,
                data: e
            };
            resJSON.fromwho = "Unknown";

            bk.data.generate_html(resJSON)
                .then(page => {
                    console.log("\nLogging, response berfore processing\n")
                    console.log(resJSON);
                    res.send(page);
                })

        });



});
module.exports = router;