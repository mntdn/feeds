var nodemailer = require('nodemailer');
var cookieSession = require("cookie-session");
var crypto = require('crypto');
var FeedParser = require('feedparser');
var request = require('request');
var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var dbLog = new sqlite.Database('feedsLog.sqlite');
var app = express();
var bodyParser = require('body-parser');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('server.config.json', 'utf8'));

var pwSalt = config.passwordSalt; // GUID used to salt passwords in the DB
var URLWithAuth = []; // an array of all the URL that needs authentication

var mailResetSalt = config.mailResetSalt; // GUID used to prove the reset is coming from the right person

app.set('trust proxy', 1) // trust first proxy

app.use(bodyParser.json());

app.use(cookieSession({
  name: 'session',
  keys: [config.cookieSessionKey1, config.cookieSessionKey2]
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

app.post('/checkUsername', function (req, res) {
	console.log(new Date(), "checkUsername POST ", req.query);
	db.serialize(function() {
		var userName = req.query.name;
		db.all("SELECT 1 FROM User WHERE Name = '" + req.query.name + "'", function(e,rows){
			if(e) throw e;
			if(rows.length > 0){
                res.json({status: 'Error'});
			} else {
                res.json({status: 'OK'});
            }
		});
	});
})

app.post('/createAccount', function (req, res) {
	console.log(new Date(), "createAccount POST ", req.body);
	crypto.pbkdf2(req.body.pass, pwSalt, 100000, 512, 'sha512', function(err, key) {
		if (err) throw err;
		var saltedPass = key.toString('hex');
		db.serialize(function() {
			db.run("INSERT INTO User (Name, Password, Mail) VALUES ('" + req.body.name + "', '"+saltedPass+"', '"+req.body.email+"')");
		});
        var transporter = nodemailer.createTransport();
        transporter.sendMail({
           from: 'feeds@' + config.mailHostname,
           to: req.body.email,
           subject: 'Welcome to Feeds',
           text: 'Welcome to feeds !\r\nGo to ' + config.webSiteUrl + ' and enjoy feeds browsing!\r\nThe Feeds team'
        });
        res.json("OK");
	});
})

app.post('/checkLogin', function (req, res) {
	console.log(new Date(), "checkLogin POST ", req.body);
	crypto.pbkdf2(req.body.pass, pwSalt, 100000, 512, 'sha512', function(err, key) {
		if (err) throw err;
		var saltedPass = key.toString('hex');
		db.serialize(function() {
			var userName = req.body.name;
			db.all("SELECT Password, IdUser FROM User WHERE Name = '" + userName + "'", function(e,rows){
				if(e) throw e;
				if(rows.length > 0){
					// we found someone
					if(rows[0]["Password"] === saltedPass){
						// and it's the good password
						req.session.userName = userName;
						req.session.userId = rows[0]["IdUser"];
						res.json({status: 'OK'});
					}
					else {
                        res.json({status: 'Error', errorMessage:'Wrong password'});
					}
				} else {
                    res.json({status: 'Error', errorMessage:'No user with this login'});
                }
			});
		});
	});
})

app.post('/sendPasswordMail', function (req, res) {
    console.log(new Date(), "sendPasswordMail POST ", req.query);
    db.all("SELECT Name FROM User WHERE Mail = '" + req.query.mail + "'", function(e,rows){
		if(e) throw e;
        console.log(rows);
        crypto.pbkdf2(rows[0].Name, mailResetSalt, 100000, 512, 'sha512', function(error, key) {
            if (error) throw error;
            var saltedName = key.toString('hex');
            var transporter = nodemailer.createTransport();
            transporter.sendMail({
               from: 'feeds@' + config.mailHostname,
               to: req.query.mail,
               subject: 'Feeds password reset',
               text: 'Hello !\r\nThis is the code to reset your password : ' + saltedName + '\r\nGo to ' + config.webSiteUrl + ', click on "Enter code" and voilà!'
            });
            res.json("OK");
        });
	});
})

app.post('/resetPassword', function (req, res) {
	console.log(new Date(), "resetPassword GET ", req.body);
    crypto.pbkdf2(req.body.login, mailResetSalt, 100000, 512, 'sha512', function(err, key) {
		if (err) throw err;
		var saltedLogin = key.toString('hex');
        if(saltedLogin === req.body.c){
            crypto.pbkdf2(req.body.pass, pwSalt, 100000, 512, 'sha512', function(error, keyPass) {
        		if (error) throw error;
        		var saltedPass = keyPass.toString('hex');
        		db.serialize(function() {
                    db.run("UPDATE User SET Password = '" + saltedPass + "' WHERE Name = '" + req.body.login + "'");
        		});
                res.json("OK");
        	});
        }
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

URLWithAuth.push("changeFeedSortOrder");
app.post('/changeFeedSortOrder', function (req, res) {
	console.log(new Date(), "changeFeedSortOrder POST ", req.query);
	db.serialize(function() {
		db.run("UPDATE UserFeed SET NewestFirst = (CASE WHEN NewestFirst = 0 THEN 1 ELSE 0 END) WHERE IdFeed = "+ req.query.IdFeed +" AND IdUser = " + req.session.userId);
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
		) AS NbItems, \
        UF.NewestFirst \
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
	FROM UserFeedContent UFC \
		INNER JOIN FeedContent FC ON FC.IdFeedContent = UFC.IdFeedContent \
    WHERE UFC.IdUser = " + req.session.userId + " AND UFC.IsSaved = 1", function(e,rows){
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
		ORDER BY IsRead ASC, FC.PublishedDate "+req.query.direction+" \
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
			SELECT " + req.session.userId + ", IdFeedContent, 1 \
			FROM FeedContent WHERE IdFeed = "+ req.query.IdFeed);
		db.run("UPDATE UserFeedContent SET IsRead = 1 \
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

URLWithAuth.push("testFeed");
app.post('/testFeed', function (req, res) {
	console.log(new Date(), "testFeed POST", req.query);
    var urlToTest = req.query.url;
    try{
        request(urlToTest)
            .on('error', function (error) {
                console.log('req ERR -- ', error.toString());
                res.json({
                    err : error.toString()
                });
            })
            .on('response', function (result) {
                var stream = this;
                if (result.statusCode != 200){
                    this.emit('error', new Error(result.statusCode));
                }
                var feedparser = new FeedParser();
                stream.pipe(feedparser);
                feedparser
                    .on('error', function(error) {
                        console.log('feed ERR -- ', error.toString());
                        try{
                            res.json({
                                err : error.toString()
                            });
                        } catch(error){
                            console.log(new Date(), 'catch feed', error);
                        }
                    })
                    .on('readable', function() {
                        var stream = this, meta = this.meta, item;
                        var nbItems = 0;
                        var finalResult = {};
                        while (item = stream.read()) {
                            nbItems++;
                            finalResult["firstPublished"] = item.date;
                            finalResult["firstTitle"] = item.title;
                            finalResult["firstContent"] = item.description;
                            finalResult["firstLink"] = item.link;
                            finalResult["firstAuthor"] = item.author;
                        }
                        finalResult["nbArticles"] = nbItems;
                        try{
                            res.json(finalResult);
                        } catch(error){
                            console.log(new Date(), 'catch read', error);
                        }
                    });
        });
    } catch(error){
        console.log(new Date(), 'catch URI', error);
        res.json({
            err : error.toString()
        });
    }
})

app.get('/feedStatsErrors', function (req, res) {
	console.log(new Date(), "feedStatsErrors GET ", req.query);
	dbLog.all("SELECT * FROM UpdateActions U WHERE Date = (SELECT MAX(Date) FROM UpdateActions WHERE IdFeed = U.IdFeed AND LogType ='Error') ORDER BY IdFeed;", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedStatsInsert', function (req, res) {
	console.log(new Date(), "feedStatsInsert GET ", req.query);
	dbLog.all("SELECT * FROM UpdateActions U WHERE Date = (SELECT MAX(Date) FROM UpdateActions WHERE IdFeed = U.IdFeed AND LogType ='insert') ORDER BY IdFeed;", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Feeds listening at http://%s:%s", host, port)
})
