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
                for(var i=0; i < result.opml.body[0].outline.length; i++){
                    if(typeof(result.opml.body[0].outline[i].$.type) === 'undefined'){
                        db.serialize(function() {
                            var stmt = db.prepare("INSERT INTO Category VALUES (NULL,?,?)");
                    		stmt.run(result.opml.body[0].outline[i].$.title, 1);
                    		stmt.finalize();
                            var curOutline = i;
                            db.all("SELECT last_insert_rowid() ID;", function(e,rows){
                    			if(e) throw e;
                    			var catID = rows[0].ID;
                                for(var j=0; j < result.opml.body[0].outline[curOutline].outline.length; j++){
                                    var stmtFeed = db.prepare("INSERT INTO Feed VALUES (NULL,?,?)");
                                	stmtFeed.run(result.opml.body[0].outline[curOutline].outline[j].$.xmlUrl, result.opml.body[0].outline[curOutline].outline[j].$.title);
                                	stmtFeed.finalize();
                                    db.all("SELECT last_insert_rowid() ID;", function(e1,rowsFeed){
                            			if(e1) throw e1;
                                        var stmtFeedUser = db.prepare("INSERT INTO UserFeed VALUES (?,?,?)");
                                    	stmtFeedUser.run(1, rowsFeed[0].ID, catID);
                                    	stmtFeedUser.finalize();
                            		});
                                    console.log('\t' + result.opml.body[0].outline[curOutline].outline[j].$.title);
                                }
                    		});
                            console.log(result.opml.body[0].outline[i].$.title);
                        });
                    } else {
                        var stmtFeed = db.prepare("INSERT INTO Feed VALUES (NULL,?,?)");
                        stmtFeed.run(result.opml.body[0].outline[i].$.xmlUrl, result.opml.body[0].outline[i].$.title);
                        stmtFeed.finalize();
                        db.all("SELECT last_insert_rowid() ID;", function(e1,rowsFeed){
                            if(e1) throw e1;
                            var stmtFeedUser = db.prepare("INSERT INTO UserFeed VALUES (?,?,?)");
                            stmtFeedUser.run(1, rowsFeed[0].ID, null);
                            stmtFeedUser.finalize();
                        });
                        console.log(result.opml.body[0].outline[i].$.title);                        
                    }
                }
            }
        });
    });
}
