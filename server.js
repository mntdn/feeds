var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();

// Tous les fichiers seront servis depuis le répertoire web
app.use(express.static('web'));

app.get('/feedsList', function (req, res) {
	console.log("feedsList GET ", req.query);
	db.all("SELECT \
		F.IdFeed, \
		F.Name, \
		( \
			SELECT COUNT(*) \
			FROM FeedContent FC \
				LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = U.IdUser AND UFC.IdFeedContent = FC.IdFeedContent \
			WHERE FC.IdFeed = F.IdFeed AND (UFC.IsRead IS NULL OR UFC.IsRead = 0) \
		) AS NbItems \
	FROM User U \
		INNER JOIN UserFeed UF ON UF.IdUser = U.IdUser \
		INNER JOIN Feed F ON F.IdFeed = UF.IdFeed \
		LEFT OUTER JOIN FeedContent FC ON FC.IdFeed = F.IdFeed \
		LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = U.IdUser AND UFC.IdFeedContent = FC.IdFeedContent \
	WHERE U.Name='" + req.query.user + "' \
	GROUP BY F.IdFeed, F.Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/toReadLaterList', function (req, res) {
	console.log("toReadLaterList GET ", req.query);
	db.all("SELECT \
		FC.IdFeedContent, FC.Title, FC.Url \
	FROM User U \
		INNER JOIN UserFeedContent UFC ON UFC.IdUser = U.IdUser AND UFC.IsSaved = 1 \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
	WHERE U.Name='" + req.query.user + "'", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedContent', function (req, res) {
	console.log("feedContent GET", req.query);
	db.all("SELECT FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, UFC.IsRead, UFC.IsSaved \
		FROM User U \
			INNER JOIN UserFeed UF ON UF.IdUser = U.IdUser AND UF.IdFeed ="+req.query.id+" \
			INNER JOIN FeedContent FC ON FC.IdFeed = UF.IdFeed \
			LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdFeedContent = FC.IdFeedContent AND UFC.IdUser = U.IdUser \
		WHERE U.Name='" + req.query.user + "' \
		ORDER BY FC.PublishedDate DESC", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.post('/changeRead', function (req, res) {
	console.log("changeRead POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
			SELECT U.IdUser, "+ req.query.IdFC +", "+ req.query.read +" \
			FROM User U \
			WHERE Name LIKE '"+ req.query.user +"';");
		db.run("UPDATE UserFeedContent SET IsRead = "+ req.query.read +" \
			WHERE IdUser = (SELECT IdUser FROM User WHERE Name LIKE '"+ req.query.user +"') AND IdFeedContent = "+ req.query.IdFC);
	});
	res.json("OK");
})

app.post('/changeSaved', function (req, res) {
	console.log("changeSaved POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsSaved) \
			SELECT U.IdUser, "+ req.query.IdFC +", "+ req.query.save +" \
			FROM User U \
			WHERE Name LIKE '"+ req.query.user +"';");
		db.run("UPDATE UserFeedContent SET IsSaved = "+ req.query.save +" \
			WHERE IdUser = (SELECT IdUser FROM User WHERE Name LIKE '"+ req.query.user +"') AND IdFeedContent = "+ req.query.IdFC);
	});
	res.json("OK");
})


var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Feeds listening at http://%s:%s", host, port)
})