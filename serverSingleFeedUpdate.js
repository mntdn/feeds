const http = require('http');
var FeedParser = require('feedparser');
var request = require('request');
var sqlite = require("sqlite3");
var crypto = require('crypto');
var db = new sqlite.Database('feeds.sqlite');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('server.config.json', 'utf8'));

const hostname = config.feedUpdateService.split(':')[0];
const port = parseInt(config.feedUpdateService.split(':')[1]);

function arrayFind(a, f){
	for(var i = 0; i < a.length; i++){
		if(a[i] === f)
			return true;
	}
	return false;
}

/*
    The server expects a json object like this one :
    {
        "IdFeed": 10,
        "Url": "http://the-witness.net/news/?feed=rss2"
    }
*/

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

                request(args.Url)
                .on('error', function (error) {
                    result.end(JSON.stringify({
                        "error": error,
                        "args": args,
                        "text": "request error"
                    }));
                })
                .on('response', function (res) {
                    var streamResponse = this;
                    if (res.statusCode != 200){
                        result.end(JSON.stringify({
                            "error": res,
                            "args": args,
                            "text": "bad response error"
                        }));
                    }
                    var feedArray = [];
                    var feedparser = new FeedParser();
                    streamResponse.pipe(feedparser);
                    feedparser
                        .on('error', function(error) {
                            result.end(JSON.stringify({
                                "error": error,
                                "args": args,
                                "text": "Feed parsing error"
                            }));
                        })
                        .on('readable', function() {
                            var stream = this, meta = this.meta, item;
                            while (item = stream.read()) {
                                feedArray.push(item);
                            }
                        })
                        .on('end', function(error) {
                            db.all("SELECT Hash FROM FeedContent WHERE IdFeed = " + args.IdFeed + " LIMIT 1", function(e2, content){
                                var nbNewArticles = 0;
                                if(e2) {
                                    result.end(JSON.stringify({
                                        "error": e2,
                                        "args": args,
                                        "text": "Erreur SQL"
                                    }));
                                } else {
                                    if(	content.length == 0) {
                                        // if there is no article in the DB we download everything
                                        var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
                                        for(var i = 0; i < feedArray.length; i++) {
                                            var item = feedArray[i];
                                            var hash = crypto.createHash('sha256');
                                            hash.update(item.title + item.link);
                                            var calcHash = hash.digest('hex');
                                            stmt.run(args.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash);
                                            nbNewArticles++;
                                        }
                                        stmt.finalize();
                                    } else {
                                        var stmt = db.prepare("\
                                            INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) \
                                            SELECT ?,?,?,?,?,?,?\
                                            FROM FeedContent\
                                            WHERE  NOT EXISTS (SELECT hash FROM feedcontent WHERE hash = ?)\
                                            LIMIT 1"
                                        );
                                        for(var i = 0; i < feedArray.length; i++) {
                                            var item = feedArray[i];
                                            var hash = crypto.createHash('sha256');
                                            hash.update(item.title + item.link);
                                            var calcHash = hash.digest('hex');
                                            stmt.run(args.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash, calcHash);
                                            nbNewArticles++;
                                        }
                                        stmt.finalize();
                                    }
                                    args["nbNewArticles"] = nbNewArticles;
                                    result.end(JSON.stringify({
                                        "success": "ok",
                                        "args": args,
                                        "text": "Feed updated"
                                    }));
                                }
                            });
                        })
                });
            } catch(jsonErr){
                result.end(JSON.stringify({
                    "error": jsonErr,
                    "text": "JSON parsing error"
                }));
            }
        });
    }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});