var FeedParser = require('feedparser');
var request = require('request');
var sqlite = require("sqlite3");
var crypto = require('crypto');

var fs = require('fs');

var db = new sqlite.Database('feeds.sqlite');
var dbLog = new sqlite.Database('feedsLog.sqlite');

var mainTableInit = false, logTableInit = false, isVerbose = false;

var nbStmt = 0;

var logStatement;

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
		db.run("CREATE TABLE IF NOT EXISTS User(IdUser INTEGER PRIMARY KEY, Name TEXT, Password TEXT);");
		db.run("CREATE TABLE IF NOT EXISTS Feed(IdFeed INTEGER PRIMARY KEY, Url TEXT, Name TEXT); ");
		db.run("CREATE TABLE IF NOT EXISTS Category(IdCategory INTEGER PRIMARY KEY, Name TEXT, IdUser INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser)); ");
		db.run("CREATE TABLE IF NOT EXISTS UserFeed(IdUser INTEGER, IdFeed INTEGER, IdCategory INTEGER, NewestFirst INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser), FOREIGN KEY(IdFeed) REFERENCES Feed(IdFeed), FOREIGN KEY(IdCategory) REFERENCES Category(IdCategory), UNIQUE(IdUser, IdFeed));");
		db.run("CREATE TABLE IF NOT EXISTS FeedContent(IdFeedContent INTEGER PRIMARY KEY, IdFeed INTEGER, PublishedDate INTEGER, Title TEXT, Content TEXT, Url TEXT, Author TEXT, Hash TEXT, FOREIGN KEY(IdFeed) REFERENCES Feed(IdFeed));");
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
	});
	dbLog.close();
}

// db.all("SELECT * FROM FeedContent", function(e2, content){
// 	if(e2) console.log("Erreur SQL -- ", e2);
// 	var i = 0;
// 	content.forEach(function(feed){
// 		var hash = crypto.createHash('sha256');
// 		hash.update(feed.Title + feed.Url);
// 		var calcHash = hash.digest('hex');
// 		var stmt = db.prepare("UPDATE FeedContent SET Hash = ? WHERE IdFeedContent = ?");
// 		stmt.run(calcHash, feed.IdFeedContent);
// 		stmt.finalize();
// 		console.log(++i + '/' + content.length);
// 	})
// });

if(!logTableInit && !mainTableInit){
	db.all("SELECT * FROM Feed", function(e,rows){
		if(e) throw e;
		if(isVerbose) console.log(new Date + " update");
		var nbFeedsToUpdate = rows.length;
		rows.forEach(function(feed){
			request(feed.Url)
			    .on('error', function (error) {
					updateLog(feed.IdFeed, 'Error', error.toString());
			    })
			    .on('response', function (res) {
			        var streamResponse = this;
			        if (res.statusCode != 200){
						this.emit('error', new Error(res.statusCode));
			        }
			        var feedparser = new FeedParser();
			        streamResponse.pipe(feedparser);
			        feedparser
			            .on('error', function(error) {
							updateLog(feed.IdFeed, 'Error', error.toString());
			            })
			            .on('readable', function() {
			                var stream = this, meta = this.meta, item;

							db.all("SELECT Hash FROM FeedContent WHERE IdFeed = " + feed.IdFeed, function(e2, content){
								if(e2 && isVerbose) console.log("Erreur SQL -- ", e2);
								if(	content.length == 0) {
									// if there is no article in the DB we download everything
									if(isVerbose) console.log(feed.IdFeed, feed.Name, " -- First download of news");
									var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
									var logStatement = dbLog.prepare("INSERT INTO UpdateActions VALUES (?,?,?,?)");
									while (item = stream.read()) {
										if(isVerbose) console.log("\t" + item.date + " -- " + item.title);
										var hash = crypto.createHash('sha256');
										hash.update(item.title + item.link);
										var calcHash = hash.digest('hex');
										stmt.run(feed.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash);
										logStatement.run(feed.IdFeed, 'insert', item.date + " -- " + item.title, (new Date()).toISOString());
					                }
									stmt.finalize();
									logStatement.finalize();
								} else {
									// first do an array of hashes
									var hashArray = [];
									for(var j = 0; j < content.length; j++){
										hashArray.push(content[j].Hash);
									}
									// let's compare hashes found in the DB with the ones we calculate
									if(isVerbose) console.log(feed.IdFeed, feed.Name, " -- Not up to date");
									var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
									var logStatement = dbLog.prepare("INSERT INTO UpdateActions VALUES (?,?,?,?)");
									while (item = stream.read()) {
										var hash = crypto.createHash('sha256');
										hash.update(item.title + item.link);
										var calcHash = hash.digest('hex');
										if(!arrayFind(hashArray, calcHash)){
											// if article not found, we add it
											stmt.run(feed.IdFeed, item.date, item.title, item.description, item.link, item.author, calcHash);
											logStatement.run(feed.IdFeed, 'insert', item.date + " -- " + item.title, (new Date()).toISOString());
										}
									}
									stmt.finalize();
									logStatement.finalize();
								}
							});

			            });
			    });
		});
	});
}
