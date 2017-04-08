const http = require('http');
var FeedParser = require('feedparser');
var request = require('request');
var sqlite = require("sqlite3");
var crypto = require('crypto');
var db = new sqlite.Database('feeds.sqlite');

const hostname = 'localhost';
const port = 3033;

function arrayFind(a, f){
	for(var i = 0; i < a.length; i++){
		if(a[i] === f)
			return true;
	}
	return false;
}

const server = http.createServer((req, result) => {
    result.statusCode = 200;
    result.setHeader('Content-Type', 'application/json');
    if (req.method == 'POST') {
        var jsonString = '';

        req.on('data', function (data) {
            jsonString += data;
        });

        req.on('end', function () {
            var args;
            try {
                args = JSON.parse(jsonString);
            } catch(jsonErr){
                result.end(JSON.stringify({
                    "errCode": jsonErr,
                    "text": "JSON parsing error"
                }));
            }

            request(args.Url)
            .on('error', function (error) {
                result.end(JSON.stringify({
                    "errCode": error,
                    "text": "request error"
                }));
            })
            .on('response', function (res) {
                var streamResponse = this;
                if (res.statusCode != 200){
                    result.end(JSON.stringify({
                        "errCode": res,
                        "text": "bad response error"
                    }));
                }
                var feedparser = new FeedParser();
                streamResponse.pipe(feedparser);
                feedparser
                    .on('error', function(error) {
                        result.end(JSON.stringify({
                            "errCode": error,
                            "text": "Feed parsing error " + args.IdFeed
                        }));
                    })
                    .on('readable', function() {
                        var stream = this, meta = this.meta, item;
                        db.all("SELECT Hash FROM FeedContent WHERE IdFeed = " + args.IdFeed, function(e2, content){
                            var nbNewArticles = 0;
                            if(e2) {
                                result.end(JSON.stringify({
                                    "errCode": e2,
                                    "text": "Erreur SQL"
                                }));
                            }
                            if(	content.length == 0) {
                                // if there is no article in the DB we download everything
                                var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
                                while (item = stream.read()) {
                                    var hash = crypto.createHash('sha256');
                                    hash.update(item.title + item.link);
                                    var calcHash = hash.digest('hex');
                                    stmt.run(args.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash);
                                    nbNewArticles++;
                                }
                                stmt.finalize();
                            } else {
                                // first do an array of hashes
                                var hashArray = [];
                                for(var j = 0; j < content.length; j++){
                                    hashArray.push(content[j].Hash);
                                }
                                // let's compare hashes found in the DB with the ones we calculate
                                var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
                                while (item = stream.read()) {
                                    var hash = crypto.createHash('sha256');
                                    hash.update(item.title + item.link);
                                    var calcHash = hash.digest('hex');
                                    if(!arrayFind(hashArray, calcHash)){
                                        // if article not found, we add it
                                        stmt.run(args.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash);
                                        nbNewArticles++;
                                    }
                                }
                                stmt.finalize();
                            }
                            args["newArticle"] = nbNewArticles;
                            result.end(JSON.stringify({
                                "success": args,
                                "text": "Feed updated"
                            }));
                        });
                    });
            });
        });
    }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});