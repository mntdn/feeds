var cookieSession = require("cookie-session");
var crypto = require('crypto');
var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();

var pwSalt = 'bec5ba18-384c-453f-8ad7-024fb594fbe1'; // GUID used to salt passwords in the DB
var URLWithAuth = []; // an array of all the URL that needs authentication

app.set('trust proxy', 1) // trust first proxy

app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}))

function urlNeedsAuth(url){
    var strippedUrl = url.substring(1, url.indexOf('?') >= 0 ? url.indexOf('?') : url.length);
    for(var i = 0; i < URLWithAuth.length; i++){
        if(URLWithAuth[i] === strippedUrl)
            return true;
    }
    return false;
}

app.use(function (req, res, next) {
  if(urlNeedsAuth(req.url)) {
	  if(req.session.userName && req.session.userId){
          // we're logged in, let's continue
		  next();
	  } else {
		  res.status(401).send("Test");
	  }
  } else {
      // the page requested doesn't need authentication to go through
      next();
  }
})

// Tous les fichiers seront servis depuis le r�pertoire web
app.use(express.static('web'));

// crypto.pbkdf2('1dv4x', pwSalt, 100000, 512, 'sha512', function(err, key) {
//     if (err) throw err;
//     console.log(key.toString('hex'));
// });

// app.get('/nbViews', function (req, res) {
// 	req.session.views = (req.session.views || 0) + 1;
// 	console.log(new Date(), "nbViews GET ", req.query);
// 	crypto.pbkdf2('1dv4x', pwSalt, 100000, 512, 'sha512', function(err, key) {
// 		if (err) throw err;
// 		res.json(key.toString('hex'));
// 	});
//
// 	res.json(req.session);
// })

URLWithAuth.push("getUsername");
app.get('/getUsername', function (req, res) {
	console.log(new Date(), "getUsername GET ", req.query);
	res.json(req.session.userName);
})

app.get('/logout', function (req, res) {
	console.log(new Date(), "logout GET ", req.query);
    req.session = null;
    res.json("OK");
})

app.post('/createAccount', function (req, res) {
	console.log(new Date(), "createAccount POST ", req.query);
	crypto.pbkdf2(req.query.pass, pwSalt, 100000, 512, 'sha512', function(err, key) {
		if (err) throw err;
		var saltedPass = key.toString('hex');
		db.serialize(function() {
			db.run("INSERT INTO User (Name, Password) VALUES ('" + req.query.name + "', '"+saltedPass+"')");
		});
        res.json("OK");
	});
})

app.post('/checkLogin', function (req, res) {
	console.log(new Date(), "checkLogin POST ", req.query);
	crypto.pbkdf2(req.query.pass, pwSalt, 100000, 512, 'sha512', function(err, key) {
		if (err) throw err;
		var saltedPass = key.toString('hex');
		db.serialize(function() {
			var userName = req.query.name;
			db.all("SELECT Password, IdUser FROM User WHERE Name = '" + req.query.name + "'", function(e,rows){
				console.log("CHeck");
				if(e) throw e;
				if(rows.length > 0){
					// we found someone
					if(rows[0]["Password"] === saltedPass){
						// and it's the good password
						req.session.userName = userName;
						req.session.userId = rows[0]["IdUser"];
						res.json("OK");
					}
					else {
						console.log("Perdu...");
					}

				}
			});
		});
	});
})

URLWithAuth.push("addFeed");
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

URLWithAuth.push("editFeed");
app.post('/editFeed', function (req, res) {
	console.log(new Date(), "editFeed POST ", req.query);
	db.serialize(function() {
		db.run("UPDATE Feed SET Url = '"+ req.query.Url +"', Name = '"+ req.query.Name +"' WHERE IdFeed = "+ req.query.IdFeed +";");
	});
})

URLWithAuth.push("deleteFeed");
app.post('/deleteFeed', function (req, res) {
	console.log(new Date(), "deleteFeed POST ", req.query);
	db.serialize(function() {
		db.run("DELETE FROM Feed WHERE IdFeed = "+ req.query.IdFeed +";");
	});
	res.json('ok');
})

URLWithAuth.push("allCategoriesList");
app.get('/allCategoriesList', function (req, res) {
	console.log(new Date(), "allCategoriesList GET ", req.query);
	db.all("SELECT \
		IdCategory, \
		Name, \
		0 ShowEmptyFeeds,\
        0 Fold\
	FROM Category \
	WHERE IdUser=" + req.session.userId + "\
	ORDER BY Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("addCategory");
app.post('/addCategory', function (req, res) {
	console.log(new Date(), "addCategory POST ", req.query);
	db.serialize(function() {
		db.run("INSERT INTO Category (Name, IdUser) VALUES ('"+ req.query.Name +"', " + req.session.userId + ")");
		db.all("SELECT IdCategory, Name FROM Category WHERE IdCategory = last_insert_rowid();", function(e,rows){
			if(e) throw e;
			res.json(rows);
		});
	});
})

URLWithAuth.push("deleteCategory");
app.post('/deleteCategory', function (req, res) {
	console.log(new Date(), "deleteCategory POST ", req.query);
	db.serialize(function() {
		db.run("DELETE FROM Category WHERE IdCategory = "+req.query.IdCategory+";");
	});
	res.json('ok');
})

URLWithAuth.push("allFeedsList");
app.get('/allFeedsList', function (req, res) {
	console.log(new Date(), "allFeedsList GET ", req.query);
	db.all("SELECT \
		F.IdFeed, \
		F.Name, \
		F.Url, \
		CASE WHEN UF.IdUser IS NULL THEN 0 ELSE 1 END IsSubscribed, \
		CASE WHEN UF.IdCategory IS NULL THEN -1 ELSE UF.IdCategory END IdCategory, \
		0 IsShown \
	FROM Feed F  \
		LEFT OUTER JOIN UserFeed UF ON UF.IdUser = " + req.session.userId + " AND UF.IdFeed = F.IdFeed", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("feedsList");
app.get('/feedsList', function (req, res) {
	console.log(new Date(), "feedsList GET ", req.query);
	db.all("SELECT \
		UF.IdCategory,\
		F.IdFeed, \
		F.Name, \
		( \
			SELECT COUNT(*) \
			FROM FeedContent FC \
				LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = " + req.session.userId + " AND UFC.IdFeedContent = FC.IdFeedContent \
			WHERE FC.IdFeed = F.IdFeed AND (UFC.IsRead IS NULL OR UFC.IsRead = 0) \
		) AS NbItems \
	FROM UserFeed UF \
		INNER JOIN Feed F ON F.IdFeed = UF.IdFeed \
		LEFT OUTER JOIN FeedContent FC ON FC.IdFeed = F.IdFeed \
		LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdUser = " + req.session.userId + " AND UFC.IdFeedContent = FC.IdFeedContent \
	WHERE UF.IdUser=" + req.session.userId + " \
	GROUP BY F.IdFeed, F.Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("toReadLaterList");
app.get('/toReadLaterList', function (req, res) {
	console.log(new Date(), "toReadLaterList GET ", req.query);
	db.all("SELECT \
		FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, \
		CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
		CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
	FROM UserFeedContent UFC ON UFC.IdUser = " + req.session.userId + " AND UFC.IsSaved = 1 \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("toReadLaterCount");
app.get('/toReadLaterCount', function (req, res) {
	console.log(new Date(), "toReadLaterCount GET ", req.query);
	db.all("SELECT \
		COUNT(*) AS Nb \
	FROM UserFeedContent UFC \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
	WHERE UFC.IdUser=" + req.session.userId + " AND UFC.IsSaved = 1", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("feedContent");
app.get('/feedContent', function (req, res) {
	console.log(new Date(), "feedContent GET", req.query);
	var itemsLimit = 15;
	db.all("SELECT FC.IdFeedContent, FC.Content, FC.PublishedDate, FC.Title, FC.Url, FC.Author, \
			CASE WHEN UFC.IsRead IS NULL THEN 0 ELSE UFC.IsRead END IsRead, \
			CASE WHEN UFC.IsSaved IS NULL THEN 0 ELSE UFC.IsSaved END IsSaved \
		FROM UserFeed UF \
			INNER JOIN FeedContent FC ON FC.IdFeed = UF.IdFeed \
			LEFT OUTER JOIN UserFeedContent UFC ON UFC.IdFeedContent = FC.IdFeedContent AND UFC.IdUser = " + req.session.userId + " \
		WHERE UF.IdUser = " + req.session.userId + " AND UF.IdFeed ="+req.query.id+" AND (UFC.IsRead IS NULL OR UFC.IsRead = 0) \
		ORDER BY IsRead ASC, FC.PublishedDate DESC \
		LIMIT "+itemsLimit, function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

URLWithAuth.push("subscribeToFeed");
app.post('/subscribeToFeed', function (req, res) {
	console.log(new Date(), "subscribeToFeed POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeed (IdUser, IdFeed) VALUES (" + req.session.userId + ", "+ req.query.IdFeed +")");
	});
	res.json("OK");
})

URLWithAuth.push("changeFeedCategory");
app.post('/changeFeedCategory', function (req, res) {
	console.log(new Date(), "changeFeedCategory POST", req.query);
	db.serialize(function() {
		db.run("UPDATE UserFeed SET IdCategory = "+ (req.query.IdCategory == -1 ? null : req.query.IdCategory) +" \
			WHERE IdFeed="+ req.query.IdFeed +" AND IdUser = " + req.session.userId);
	});
	res.json("OK");
})

URLWithAuth.push("unsubscribeFromFeed");
app.post('/unsubscribeFromFeed', function (req, res) {
	console.log(new Date(), "unsubscribeFromFeed POST", req.query);
	db.serialize(function() {
		db.run("DELETE FROM UserFeed WHERE IdUser = " + req.session.userId + " AND IdFeed = " + req.query.IdFeed);
	});
	res.json("OK");
})

URLWithAuth.push("markAllRead");
app.post('/markAllRead', function (req, res) {
	console.log(new Date(), "markAllRead POST", req.query);
	db.serialize(function() {
		// TODO : n'ins�rer que les posts que l'utilisateur n'a pas d�j� lu
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
			SELECT " + req.session.userId + ", FC.IdFeedContent, 1 \
			FROM FeedContent FC ON FC.IdFeed = "+ req.query.IdFeed);
		db.run("UPDATE UserFeedContent SET IsRead = 1 \
			WHERE IdUser = " + req.session.userId + " \
				AND IdFeedContent IN (SELECT IdFeedContent FROM FeedContent WHERE IdFeed = '"+ req.query.IdFeed +"')");
	});
	res.json("OK");
})

URLWithAuth.push("markAllUnread");
app.post('/markAllUnread', function (req, res) {
	console.log(new Date(), "markAllUnread POST", req.query);
	db.serialize(function() {
		db.run("DELETE FROM UserFeedContent \
			WHERE IdUser = " + req.session.userId + " \
				AND IdFeedContent IN (SELECT IdFeedContent FROM FeedContent WHERE IdFeed = '"+ req.query.IdFeed +"')");
	});
	res.json("OK");
})

URLWithAuth.push("changeRead");
app.post('/changeRead', function (req, res) {
	console.log(new Date(), "changeRead POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsRead) \
			VALUES (" + req.session.userId + ", "+ req.query.IdFC +", "+ req.query.read +")");
		db.run("UPDATE UserFeedContent SET IsRead = "+ req.query.read +" \
			WHERE IdUser = " + req.session.userId + " AND IdFeedContent = "+ req.query.IdFC);
	});
	res.json("OK");
})

URLWithAuth.push("changeSaved");
app.post('/changeSaved', function (req, res) {
	console.log(new Date(), "changeSaved POST", req.query);
	db.serialize(function() {
		db.run("INSERT OR IGNORE INTO UserFeedContent (IdUser, IdFeedContent, IsSaved) \
			VALUES (" + req.session.userId + ", "+ req.query.IdFC +", "+ req.query.save +")");
		db.run("UPDATE UserFeedContent SET IsSaved = "+ req.query.save +" \
			WHERE IdUser = " + req.session.userId + " AND IdFeedContent = "+ req.query.IdFC);
	});
	res.json("OK");
})


var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Feeds listening at http://%s:%s", host, port)
})
