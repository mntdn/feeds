var express = require('express');
var nodemailer = require('nodemailer');
var bodyParser = require('body-parser');
var FeedParser = require('feedparser');
var request = require('request');
var sqlite = require("sqlite3");
var crypto = require('crypto');
var db = new sqlite.Database('feeds.sqlite');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('server.config.json', 'utf8'));

const hostname = config.feedUpdateService.split(':')[0];
const port = parseInt(config.feedUpdateService.split(':')[1]);

function arrayFind(a, f) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] === f)
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

const app = express()
app.use(bodyParser.json());

app.use(function (err, req, res, next) {
    console.log("Error !!", err);
    if(err.severity == errors.high){
        var transporter = nodemailer.createTransport({
            port: 25,
            host: 'localhost',
            tls: {rejectUnauthorized: false}
        });
        transporter.sendMail({
            from: 'feeds@' + config.mailHostname,
            to: config.errorMailTo,
            subject: 'Critical error in Feeds update',
            text: `Voici l'erreur : ${err}`
        });
    }
    if(!err.isOperational)
        next(err);
});

app.post('/', function (req, res) {
    console.log(new Date(), "Feed Get ", req.body);
    // var streamResponse = this;
    var args = req.body;
    var reqRss = request(args.Url)
    var feedparser = new FeedParser();
    var isError = false;
    reqRss.on('error', function (error) {
        isError = true;
        res.json({
            "error": error,
            "args": args,
            "text": "Feed URL error"
        });
    });

    reqRss.on('response', function (resRss) {
        if(isError)
            return;
        var s = this; // `this` is `req`, which is a stream

        if (resRss.statusCode !== 200) {
            this.emit('error', new Error('Bad status code'));
        }
        else {
            s.pipe(feedparser);
        }
    });
    var feedArray = [];
    feedparser
        .on('error', function (error) {
            if(isError)
                return;
            isError = true;
            res.json({
                "error": error,
                "args": args,
                "text": "Feed parsing error"
            });
        })
        .on('readable', function () {
            if(isError)
                return;
            var stream = this, meta = this.meta, item;
            while (item = stream.read()) {
                feedArray.push(item);
            }
        })
        .on('end', function (error) {
            if (!isError) {
                db.all("SELECT Hash FROM FeedContent WHERE IdFeed = " + args.IdFeed + " LIMIT 1", function (e2, content) {
                    var nbNewArticles = 0;
                    if (e2) {
                        res.json({
                            "error": e2,
                            "args": args,
                            "text": "Erreur SQL"
                        });
                    } else {
                        if (content.length == 0) {
                            // if there is no article in the DB we download everything
                            var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
                            for (var i = 0; i < feedArray.length; i++) {
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
                            for (var i = 0; i < feedArray.length; i++) {
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
                        res.json({
                            "success": "ok",
                            "args": args,
                            "text": "Feed updated"
                        });
                    }
                });
            }
        });
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
})