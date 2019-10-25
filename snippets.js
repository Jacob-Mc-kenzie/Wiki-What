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