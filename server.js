var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();


// Tous les fichiers seront servis depuis le r�pertoire web
app.use(express.static('web'));
// app.use(express.json());

app.post('/addFeed', function (req, res) {
	console.log(new Date(), "addFeed POST ", req.query);
	db.serialize(function() {
		db.run("INSERT INTO Feed (Url, Name) \
				VALUES ('"+ req.query.Url +"', '"+ req.query.Name +"');");
		db.all("SELECT * FROM Feed WHERE IdFeed = last_insert_rowid();", function(e,rows){
			if(e) throw e;
			res.json(rows);
		});
	});
})

app.post('/editFeed', function (req, res) {
	console.log(new Date(), "editFeed POST ", req.query);
	db.serialize(function() {
		db.run("UPDATE Feed SET Url = '"+ req.query.Url +"', Name = '"+ req.query.Name +"' WHERE IdFeed = "+ req.query.IdFeed +";");
	});
})

app.post('/deleteFeed', function (req, res) {
	console.log(new Date(), "deleteFeed POST ", req.query);
	db.serialize(function() {
		db.run("DELETE FROM Feed WHERE IdFeed = "+ req.query.IdFeed +";");
	});
	res.json('ok');
})

app.get('/allCategoriesList', function (req, res) {
	console.log(new Date(), "allCategoriesList GET ", req.query);
	db.all("SELECT \
		C.IdCategory, \
		C.Name \
	FROM User U \
		INNER JOIN Category C ON U.IdUser = C.IdUser \
	WHERE U.Name='" + req.query.user + "'\
	ORDER BY C.Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.post('/addCategory', function (req, res) {
	console.log(new Date(), "addCategory POST ", req.query);
	db.serialize(function() {
		db.run("INSERT INTO Category (Name, IdUser) \
				SELECT '"+ req.query.Name +"', IdUser \
				FROM User \
				WHERE Name = '"+ req.query.user +"';");
		db.all("SELECT IdCategory, Name FROM Category WHERE IdCategory = last_insert_rowid();", function(e,rows){
			if(e) throw e;
			res.json(rows);
		});
	});
})

app.post('/deleteCategory', function (req, res) {
	console.log(new Date(), "deleteCategory POST ", req.query);
	db.serialize(function() {
		db.run("DELETE FROM Category WHERE IdCategory = "+req.query.IdCategory+";");
	});
	res.json('ok');
})

app.get('/allFeedsList', function (req, res) {
	console.log(new Date(), "allFeedsList GET ", req.query);
	db.all("SELECT \
		F.IdFeed, \
		F.Name, \
		F.Url, \
		CASE WHEN UF.IdUser IS NULL THEN 0 ELSE 1 END IsSubscribed, \
		CASE WHEN UF.IdCategory IS NULL THEN -1 ELSE UF.IdCategory END IdCategory, \
		0 IsShown \
	FROM User U \
		CROSS JOIN Feed F  \
		LEFT OUTER JOIN UserFeed UF ON UF.IdUser = U.IdUser AND UF.IdFeed = F.IdFeed \
	WHERE U.Name='" + req.query.user + "'", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedsList', function (req, res) {
	console.log(new Date(), "feedsList GET ", req.query);
	db.all("SELECT \
		C.Name CategoryName,\
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
		LEFT OUTER JOIN Category C ON C.IdCategory = UF.IdCategory \
	WHERE U.Name='" + req.query.user + "' \
	GROUP BY F.IdFeed, F.Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/toReadLaterList', function (req, res) {
	console.log(new Date(), "toReadLaterList GET ", req.query);
	db.all("SELECT \
		FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, \
		CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
		CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
	FROM User U \
		INNER JOIN UserFeedContent UFC ON UFC.IdUser = U.IdUser AND UFC.IsSaved = 1 \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
	WHERE U.Name='" + req.query.user + "'", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedContent', function (req, res) {
	console.log(new Date(), "feedContent GET", req.query);
	db.all("SELECT FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, FC.Author, \
			CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
			CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
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

app.post('/subscribeToFeed', function (req, res) {
	console.log(new Date(), "subscribeToFeed POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeed (IdUser, IdFeed) \
			SELECT U.IdUser, "+ req.query.IdFeed +" \
			FROM User U \
			WHERE Name LIKE '"+ req.query.user +"';");
	});
	res.json("OK");
})

app.post('/changeFeedCategory', function (req, res) {
	console.log(new Date(), "changeFeedCategory POST", req.query);
	db.serialize(function() {
		db.run("UPDATE UserFeed SET IdCategory = "+ (req.query.IdCategory == -1 ? null : req.query.IdCategory) +" \
			WHERE IdFeed="+ req.query.IdFeed +" AND IdUser = (SELECT IdUser	FROM User WHERE Name = '"+ req.query.user +"')");
	});
	res.json("OK");
})

app.post('/unsubscribeFromFeed', function (req, res) {
	console.log(new Date(), "unsubscribeFromFeed POST", req.query);
	db.serialize(function() {
		db.run("DELETE FROM UserFeed \
			WHERE IdUser = (SELECT IdUser FROM User WHERE Name LIKE '"+ req.query.user +"') \
				AND IdFeed = " + req.query.IdFeed);
	});
	res.json("OK");
})

app.post('/markAllRead', function (req, res) {
	console.log(new Date(), "markAllRead POST", req.query);
	db.serialize(function() {
		// TODO : n'ins�rer que les posts que l'utilisateur n'a pas d�j� lu
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
			SELECT U.IdUser, FC.IdFeedContent, 1 \
			FROM User U \
				INNER JOIN FeedContent FC ON FC.IdFeed = "+ req.query.IdFeed +" \
			WHERE Name LIKE '"+ req.query.user +"';");
		db.run("UPDATE UserFeedContent SET IsRead = 1 \
			WHERE IdUser = (SELECT IdUser FROM User WHERE Name LIKE '"+ req.query.user +"') \
				AND IdFeedContent IN (SELECT IdFeedContent FROM FeedContent WHERE IdFeed = '"+ req.query.IdFeed +"')");
	});
	res.json("OK");
})

app.post('/markAllUnread', function (req, res) {
	console.log(new Date(), "markAllUnread POST", req.query);
	db.serialize(function() {
		db.run("DELETE FROM UserFeedContent \
			WHERE IdUser = (SELECT IdUser FROM User WHERE Name LIKE '"+ req.query.user +"') \
				AND IdFeedContent IN (SELECT IdFeedContent FROM FeedContent WHERE IdFeed = '"+ req.query.IdFeed +"')");
	});
	res.json("OK");
})

app.post('/changeRead', function (req, res) {
	console.log(new Date(), "changeRead POST", req.query);
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
	console.log(new Date(), "changeSaved POST", req.query);
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
