var feedRead = require("feed-read");
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
	if(typeof(finish) !== 'undefined' && finish){
		if(logStatement)
			logStatement.finalize();
		return true;
	}
	if(nbStmt >= 500){
		console.log("500 limit");
		logStatement.finalize();
		logStatement = dbLog.prepare("INSERT INTO UpdateActions VALUES (?,?,?,?)");
		nbStmt = 0;
	}
	if(typeof(logStatement) === 'undefined')
	 	logStatement = dbLog.prepare("INSERT INTO UpdateActions VALUES (?,?,?,?)");
	logStatement.run(idFeed, type, message, (new Date()).toISOString());
	nbStmt++;
	console.log(nbStmt);
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
		db.run("CREATE TABLE IF NOT EXISTS UserFeed(IdUser INTEGER, IdFeed INTEGER, IdCategory INTEGER, FOREIGN KEY(IdUser) REFERENCES User(IdUser), FOREIGN KEY(IdFeed) REFERENCES Feed(IdFeed), FOREIGN KEY(IdCategory) REFERENCES Category(IdCategory), UNIQUE(IdUser, IdFeed));");
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

// feedRead('http://indiegamehouse.com/feed/', function(err, articles){
// 	if(err) {
// 		console.log(feed.Url, 'Error', err.toString());
// 	} else {
// 		for(var i = 0; i < articles.length; i++){
// 			// console.log("\t" + articles[i].published + " -- " + articles[i].title);
// 			var hash = crypto.createHash('sha256');
// 			hash.update(articles[i].title + articles[i].link);
// 			// fs.writeFile("feedf" + i + ".txt", articles[i].content);
// 			var calcHash = hash.digest('hex');
// 			// console.log(articles[i].published, articles[i].title, articles[i].content, articles[i].link, articles[i].author);
// 			console.log(articles[i].title, calcHash);
// 		}
// 	}
// });

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
			feedRead(feed.Url, function(err, articles){
				if(err) {
					updateLog(feed.IdFeed, 'Error', err.toString());
					nbFeedsToUpdate--;
					// console.log("*-*-*-*-*- NB : ", nbFeedsToUpdate);
					if(nbFeedsToUpdate === 0){
						// on met à jour le log
						if(isVerbose) console.log("LOG UPDATE");
						updateLog(0,'','',true);
						console.log("before end", nbStmt);
					}
				} else {
					db.all("SELECT Hash FROM FeedContent WHERE IdFeed = " + feed.IdFeed, function(e2, content){
						if(e2 && isVerbose) console.log("Erreur SQL -- ", e2);
						if(articles && articles.length > 0){
							if(	content.length == 0) {
								// if there is no article in the DB we download everything
								if(isVerbose) console.log(feed.IdFeed, feed.Name, " -- First download of news");
								var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?)");
								for(var i = 0; i < articles.length; i++){
									if(isVerbose) console.log("\t" + articles[i].published + " -- " + articles[i].title);
									var hash = crypto.createHash('sha256');
									hash.update(articles[j].title + articles[j].link);
									var calcHash = hash.digest('hex');
									stmt.run(feed.IdFeed, articles[i].published, articles[i].title, articles[i].content, articles[i].link, articles[i].author, calcHash);
									updateLog(feed.IdFeed, 'insert', articles[i].published + " -- " + articles[i].title);
								}
								stmt.finalize();
							} else {
								// first do an array of hashes
								var hashArray = [];
								for(var j = 0; j < content.length; j++)
									hashArray.push(content[j].Hash);
								// let's compare hashes found in the DB with the ones we calculate
								if(isVerbose) console.log(feed.IdFeed, feed.Name, " -- Not up to date");
								for(var j = 0; j < articles.length; j++){
									var hash = crypto.createHash('sha256');
									hash.update(articles[j].title + articles[j].link);
									var calcHash = hash.digest('hex');
									var stmt = db.prepare("INSERT INTO FeedContent(IdFeed, PublishedDate, Title, Content, Url, Author, Hash) VALUES (?,?,?,?,?,?,?)");
									if(!arrayFind(hashArray, calcHash)){
										// if article not found, we add it
										stmt.run(feed.IdFeed, articles[j].published, articles[j].title, articles[j].content, articles[j].link, articles[j].author, calcHash);
										updateLog(feed.IdFeed, 'insert', articles[j].published + " -- " + articles[j].title);
									}
								}
								stmt.finalize();
							}
						}
						nbFeedsToUpdate--;
						// console.log("*-*-*-*-*- NB : ", nbFeedsToUpdate);
						if(nbFeedsToUpdate === 0){
							// on met à jour le log
							if(isVerbose) console.log("LOG UPDATE");
							updateLog(0,'','',true);
							console.log("after end", nbStmt);
						}
					});
				}
			});
		});
	});
}
