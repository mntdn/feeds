var FeedParser = require('feedparser');
var request = require('request');
var sqlite = require("sqlite3");
var crypto = require('crypto');
var async = require("async");

var fs = require('fs');

var db = new sqlite.Database('feeds.sqlite');
var dbLog = new sqlite.Database('feedsLog.sqlite');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('server.config.json', 'utf8'));

var mainTableInit = false, logTableInit = false, isVerbose = false;

var nbStmt = 0;

var logStatement;

var socket = require('socket.io-client')('http://'+config.socketHost);

function arrayFind(a, f){
	for(var i = 0; i < a.length; i++){
		if(a[i] === f)
			return true;
	}
	return false;
}

function updateLog(idFeed, type, message, finish){
	 var logStatement = dbLog.prepare("INSERT INTO UpdateActions VALUES (?,?,?,?)");
	logStatement.run(idFeed, type, message, (new Date()).toISOString());
	logStatement.finalize();
	if(isVerbose)
		console.log(type, idFeed, " -- ", message);
}

// if some parameters have been passed
if(process.argv.length > 2) {
	for(var i = 2; i < process.argv.length; i++){
		switch (process.argv[i]) {
			case "initMain":
				mainTableInit = true;
				break;
			case "initLog":
				logTableInit = true;
				break;
			case "verbose":
				isVerbose = true;
				break;
			default:
				break;
		}
	}
}

if(mainTableInit) {
	db.serialize(function() {
		db.run("DROP TABLE IF EXISTS Feed;");
		db.run("DROP TABLE IF EXISTS FeedContent;");
		db.run("CREATE TABLE IF NOT EXISTS User(IdUser INTEGER PRIMARY KEY, Name TEXT, Password TEXT, Mail TEXT);");
		db.run("CREATE UNIQUE INDEX IX_UNIQUE_UserName ON User(Name);");
		db.run("CREATE TABLE IF NOT EXISTS Feed(IdFeed INTEGER PRIMARY KEY, Url TEXT, Name TEXT); ");
		db.run("CREATE TABLE IF NOT EXISTS Category(IdCategory INTEGER PRIMARY KEY, Name TEXT, IdUser INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser)); ");
		db.run("CREATE TABLE IF NOT EXISTS UserFeed(IdUser INTEGER, IdFeed INTEGER, IdCategory INTEGER, NewestFirst INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser), FOREIGN KEY(IdFeed) REFERENCES Feed(IdFeed), FOREIGN KEY(IdCategory) REFERENCES Category(IdCategory), UNIQUE(IdUser, IdFeed));");
		db.run("CREATE TABLE IF NOT EXISTS FeedContent(IdFeedContent INTEGER PRIMARY KEY, IdFeed INTEGER, PublishedDate INTEGER, Title TEXT, Content TEXT, Url TEXT, Author TEXT, Hash TEXT, FOREIGN KEY(IdFeed) REFERENCES Feed(IdFeed));");
		db.run("CREATE INDEX IX_FeedContent ON FeedContent(IdFeed);");
		db.run("CREATE TABLE IF NOT EXISTS UserFeedContent(IdUser INTEGER, IdFeedContent INTEGER, IsRead INTEGER, IsSaved INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser), FOREIGN KEY(IdFeedContent) REFERENCES FeedContent(IdFeedContent), UNIQUE(IdUser, IdFeedContent));");
	});
	db.close();
}

if(logTableInit) {
	dbLog.serialize(function() {
		dbLog.run("DROP TABLE IF EXISTS UserActions;");
		dbLog.run("DROP TABLE IF EXISTS UpdateActions;");
		dbLog.run("CREATE TABLE UserActions(IdUser INTEGER, Url TEXT, Message Text, Date Text);");
		dbLog.run("CREATE TABLE UpdateActions(IdFeed INTEGER, LogType Text, Message Text, Date Text);");
		dbLog.run("CREATE INDEX IX_UpdateFeed ON UpdateActions (IdFeed);");
		dbLog.run("CREATE INDEX IX_UpdateType ON UpdateActions (IdFeed, LogType);");
		dbLog.run("CREATE INDEX IX_UpdateDate ON UpdateActions (IdFeed, Date);");
	});
	dbLog.close();
}

if(!logTableInit && !mainTableInit){
	var start = process.hrtime();

	var elapsed_time = function(note){
		var precision = 3; // 3 decimal places
		var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
		console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
		start = process.hrtime(); // reset the timer
    }
    
    var q = async.queue(function(feed, callback) {
        request.post(
            'http://' + config.feedUpdateService,
            { 
                json: {
                    "IdFeed": feed.IdFeed,
                    "Url": feed.Url
                }
            },
            (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    if(body.error){
                        if(isVerbose) console.log("error", body.args.IdFeed);
                        updateLog(feed.IdFeed, 'Error', JSON.stringify(body));
                    } else {
                        if(isVerbose) console.log("success", body.args.IdFeed);							
                        updateLog(feed.IdFeed, 'Insert', JSON.stringify(body.args));
                        // socket.emit('updateFeed', {'IdFeed': body.args.IdFeed, 'NbNewArticles': body.args.nbNewArticles});
                    }
                }
                callback();
            }
        );
    }, 4);

    q.drain = function(){
        elapsed_time("update finished");
        process.exit();
    }

	db.all("SELECT * FROM Feed", function(e,rows){
		if(e) throw e;
		console.log(new Date + " update");
		rows.forEach(function(feed){
			q.push(feed, () => {
                console.log(feed.Url + " finished");
            });
		});
	});
}