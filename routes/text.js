const bk = require('./data.js');
var express = require('express');
var router = express.Router();


router.get('/:perma', function (req, res, next) {

    var resJSON = {
        query: null,
        type: "TEXT",
        content: null,
        fromwho: "Wikipedia API"
    };

    if (req.params.perma != null) {
        const newstate = req.params.perma;
        resJSON.query = newstate;

        bk.data.check_cache(newstate)
            .then((cacheres) => {
                if (cacheres.status == "MISSING") { return bk.data.check_database(newstate); }
                else { return cacheres; }
            })
            .then((dbres) => {
                if (dbres.status == "OK") {
                    resJSON.content = dbres.data;
                    resJSON.fromwho = (dbres.message == "REDIS_EXISTS" ? "Redis Cache" : "S3 Bucket");
                }
                else if (dbres.status == "MISSING") {
                    res.redirect("/quote");
                }
                else {
                    resJSON.type = "ERROR";
                    resJSON.content = dbres;
                    resJSON.fromwho = "Unknown";
                }
                return bk.data.generate_html(resJSON)
            })
            .then((page) => {
                console.log("\nLogging, response berfore processing(/id)\n")
                console.log(resJSON);
                const code = (resJSON.type != "ERROR" ? 200 : 500);
                res.statusCode = code;
                res.end(page);
            })
            .catch((e) => {
                resJSON.type = "ERROR";
                resJSON.content = {
                    status: "ERROR",
                    message: "UNKNOWN_STATE-RESTORE_ERROR",
                    detail: "An unknown error has occured, it says: " + e.message,
                    data: e
                };
                resJSON.fromwho = "Unknown";
            });
    }
    if (resJSON.query = null) {
        res.redirect("/quote");
    }
});

router.get('/', function (req, res, next) {

    var resJSON = {
        query: null,
        type: "TEXT",
        content: null,
        fromwho: "Wikipedia API"
    };

    bk.data.generate_url()
        .then(genres => {
            console.log("\n 1.Url data generated(/):\n")
            console.log(genres);
            if (genres.status == "OK") {

                res.redirect(303, "/quote/" + genres.data);
            }
            else if(genres.status == "EXISTS"){
                res.redirect(303, "/quote");
            }
            else {
                resJSON.type = "ERROR";
                resJSON.content = genres;
                resJSON.fromwho = "Wikipedia API";
            }
        })
        .then(() => {
            bk.data.generate_html(resJSON)
                .then(page => {
                    console.log("\n 2.Logging, response berfore processing(/)\n")
                    console.log(resJSON);
                    const code = (resJSON.type != "ERROR" ? 200 : 500);
                    res.statusCode = code;
                    res.end(page);
                })

        })
        .catch((e) => {
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
                    const code = (resJSON.type != "ERROR" ? 200 : 500);
                    res.statusCode = code;
                    res.end(page);
                })

        });



});


module.exports = router;