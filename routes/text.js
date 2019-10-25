import { check_database, check_cache, generate_html } from './data.js';
var express = require('express');
var router = express.Router();

/* GET users listing. */
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

        check_cache(newstate)
            .then((cacheres) => {
                if (cacheres.status == "MISSING") {return check_database(newstate);}
                else {return cacheres;}
            })
            .then((dbres) => {
                if (dbres.status == "OK") 
                {
                    resJSON.content = dbres;
                    resJSON.fromwho = (dbres.message == "REDIS_EXISTS"? "Redis Cache":"S3 Bucket");    
                }
                else if (dbres.status == "MISSING") {
                    resJSON.query = null;   
                }
                else {
                    resJSON.content = dbres;
                    resJSON.fromwho = "Unknown";
                }
        })
        .catch((e)=>{
            resJSON.content = {
                status: "ERROR",
                message: "UNKNOWN_ERROR",
                detail: "An unknown error has occured, it says: "+e.message,
                data: e
            };
            resJSON.fromwho = "Unknown";
        });
    }
    if (resJSON.query = null){
        
    }
});

module.exports = router;