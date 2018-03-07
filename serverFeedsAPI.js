var express = require('express');
var bodyParser = require('body-parser');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.json());

app.get('/allCategoriesList', function (req, res) {
	console.log(new Date(), "allCategoriesList GET ", req.query);
    var userId = 1;
	db.all("SELECT \
		IdCategory, \
		Name, \
		0 ShowEmptyFeeds,\
        0 Fold\
	FROM Category \
	WHERE IdUser=" + userId + "\
	ORDER BY Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
});

app.get('/feedsList', function (req, res) {
	console.log(new Date(), "feedsList GET ", req.query);
    var userId = 1;
	db.all("SELECT \
		UF.IdCategory,\
		F.IdFeed, \
		F.Name, \
		( \
			SELECT COUNT(*) \
			FROM FeedContent FC \
				LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = " + userId + " AND UFC.IdFeedContent = FC.IdFeedContent \
			WHERE FC.IdFeed = F.IdFeed AND (UFC.IsRead IS NULL OR UFC.IsRead = 0) \
		) AS NbItems, \
        UF.NewestFirst \
	FROM UserFeed UF \
		INNER JOIN Feed F ON F.IdFeed = UF.IdFeed \
		LEFT OUTER JOIN FeedContent FC ON FC.IdFeed = F.IdFeed \
		LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = " + userId + " AND UFC.IdFeedContent = FC.IdFeedContent \
	WHERE UF.IdUser=" + userId + " \
	GROUP BY F.IdFeed, F.Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedContent', function (req, res) {
	console.log(new Date(), "feedContent GET", req.query);
    var userId = 1;
	var itemsLimit = req.query.nbItems || 15;
	db.all("SELECT FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, FC.Author, \
			CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
			CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
		FROM UserFeed UF \
			INNER JOIN FeedContent FC ON FC.IdFeed = UF.IdFeed \
			LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdFeedContent = FC.IdFeedContent AND UFC.IdUser = " + userId + " \
		WHERE UF.IdUser = " + userId + " AND UF.IdFeed ="+req.query.id+" AND (UFC.IsRead IS NULL OR UFC.IsRead = 0) \
		ORDER BY IsRead ASC, FC.PublishedDate "+req.query.direction+" \
		LIMIT "+itemsLimit, function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/loadItem', function (req, res) {
	console.log(new Date(), "loadItem GET", req.query);
    var userId = 1;
	db.all("SELECT FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, FC.Author, \
			CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
			CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
		FROM UserFeed UF \
			INNER JOIN FeedContent FC ON FC.IdFeed = UF.IdFeed AND FC.IdFeedContent = "+req.query.idFeedContent+" \
			LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdFeedContent = FC.IdFeedContent AND UFC.IdUser = " + userId + " \
		WHERE UF.IdUser = " + userId + " AND UF.IdFeed ="+req.query.idFeed, function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.post('/changeRead', function (req, res) {
	console.log(new Date(), "changeRead POST", req.body);
    var userId = 1;
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
			VALUES (" + userId + ", "+ req.body.IdFC +", "+ req.body.read +")");
		db.run("UPDATE UserFeedContent SET IsRead = "+ req.body.read +" \
			WHERE IdUser = " + userId + " AND IdFeedContent = "+ req.body.IdFC);
	});
	res.json("OK");
})

app.post('/markAllRead', function (req, res) {
    console.log(new Date(), "markAllRead POST", req.body);
    if(req.body.idFeed){
        var userId = 1;
        db.serialize(function() {
            db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
                SELECT " + userId + ", IdFeedContent, 1 \
                FROM FeedContent WHERE IdFeed = "+ req.body.IdFeed);
            db.run("UPDATE UserFeedContent SET IsRead = 1 \
                WHERE IdUser = " + userId + " \
                    AND IdFeedContent IN (SELECT IdFeedContent FROM FeedContent WHERE IdFeed = '"+ req.body.IdFeed +"')");
        });
    }
	res.json("OK");
})

app.post('/changeSaved', function (req, res) {
	console.log(new Date(), "changeSaved POST", req.body);
    var userId = 1;
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsSaved) \
			VALUES (" + userId + ", "+ req.body.IdFC +", "+ req.body.save +")");
		db.run("UPDATE UserFeedContent SET IsSaved = "+ req.body.save +" \
			WHERE IdUser = " + userId + " AND IdFeedContent = "+ req.body.IdFC);
	});
	res.json("OK");
})

app.get('/toReadLaterList', function (req, res) {
	console.log(new Date(), "toReadLaterList GET ", req.query);
    var userId = 1;
	db.all("SELECT \
		FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, \
		CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
		CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
	FROM UserFeedContent UFC \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
    WHERE UFC.IdUser = " + userId + " AND UFC.IsSaved = 1", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/toReadLaterCount', function (req, res) {
	console.log(new Date(), "toReadLaterCount GET ", req.query);
    var userId = 1;
	db.all("SELECT \
		COUNT(*) AS Nb \
	FROM UserFeedContent UFC \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
	WHERE UFC.IdUser=" + userId + " AND UFC.IsSaved = 1", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})


var server = app.listen(8181, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Feeds API listening at http://%s:%s", host, port)
})
