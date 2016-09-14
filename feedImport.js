var fs = require('fs');
var xml2js = require('xml2js');
var sqlite = require("sqlite3");

if(process.argv.length > 2) {
    var db = new sqlite.Database('feeds.sqlite');
	var opmlFile = process.argv[2];
    var parser = new xml2js.Parser();
    fs.readFile(__dirname + '/' + opmlFile, function(err, data) {
        parser.parseString(data, function (err, result) {
            if(result.opml){
                var categories = {};
                var feeds = [];
                for(var i=0; i < result.opml.body[0].outline.length; i++){
                    if(typeof(result.opml.body[0].outline[i].$.type) === 'undefined'){
                        categories[result.opml.body[0].outline[i].$.title] = null;
                        var curOutline = i;
                        for(var j=0; j < result.opml.body[0].outline[curOutline].outline.length; j++){
                            feeds.push({
                                "category": result.opml.body[0].outline[curOutline].$.title,
                                "url": result.opml.body[0].outline[curOutline].outline[j].$.xmlUrl,
                                "title": result.opml.body[0].outline[curOutline].outline[j].$.title
                            })
                        }
                    } else {
                        feeds.push({
                            "category": null,
                            "url": result.opml.body[0].outline[i].$.xmlUrl,
                            "title": result.opml.body[0].outline[i].$.title
                        })
                    }
                }
                for (var cat in categories) {
                    if (categories.hasOwnProperty(cat)) {
                        db.serialize(function(){
                            var stmt = db.prepare("INSERT INTO Category VALUES (NULL,?,?)");
                            stmt.run(cat, 1);
                            stmt.finalize();
                            // console.log("before", cat);
                            var tmpCat = cat;
                            db.all("SELECT last_insert_rowid() ID;", function(e,rows){
                                if(e) throw e;
                                categories[tmpCat] = rows[0].ID;
                                // console.log(tmpCat, rows[0].ID);
                            })
                        })
                    }
                }
                setTimeout(function (){
                    console.log(categories);
                }, 500);

                feeds.forEach(function(feed){
                    db.serialize(function(){
                        var stmtFeed = db.prepare("INSERT INTO Feed VALUES (NULL,?,?)");
                        stmtFeed.run(feed.url, feed.title);
                        stmtFeed.finalize();
                        db.all("SELECT last_insert_rowid() ID;", function(e1,rowsFeed){
                            if(e1) throw e1;
                            feed["id"] = rowsFeed[0].ID;
                        });
                    });
                });
                setTimeout(function (){
                    console.log(feeds);

                    var stmtFeedUser = db.prepare("INSERT INTO UserFeed VALUES (?,?,?)");
                    feeds.forEach(function(feed){
                        stmtFeedUser.run(1, feed.id, feed.category === null ? null : categories[feed.category]);
                    });
                    stmtFeedUser.finalize();

                }, 5000);
            }
        });
    });
}
