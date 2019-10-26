//redirect to the desired url

app.use('/thelocaurl', (req,res) =>{
    res.redirect(404, '/');
    //can also do absolute urls
});

app.get('/:name', (req,res)=>{
    res.location('/fish'); //tells the browser that this is where the info cam from
    res.end("wow"+req.params.name);
});

//from https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
String.prototype.hashCode = function() {
    var hash = 0;
    if (this.length == 0) {
        return hash;
    }
    for (var i = 0; i < this.length; i++) {
        var char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

// https://github.com/elzup/random-word-wikipedia

// from https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

function randomValue(a, b) {
    return a[Object.keys(a)[randomIntFromInterval(0, b)]];
  }
// https://en.wikipedia.org/api/rest_v1/#/Page%20content/get_page_random__format_
//https://www.mediawiki.org/w/api.php?action=query&generator=random&rnlimit=5&prop=extracts&format=json&rnnamespace=0
app.get('/wikipedia', (req,res)=>{
    return axios.get("https://en.wikipedia.org/api/rest_v1/page/random/summary")
    .then(response =>{
        //const pag = response.data.query.pages;
        console.log(response);
        //const title = randomValue(pag, pag.lenght-1).title;
        const page = `
        <html>
        <head></head>
        <body>
        <h1>`+response.data.title+`</h1>
        <img src="`+response.data.thumbnail.source+`"/>
        <p>`+response.data.extract_html+`</p>
        </body>
        </html>`;
        return res.send(page);
    })
    .catch(e =>{
        console.log(e);
        res.send(e);
    })
    //res.redirect(301, 'https://www.google.com');
});