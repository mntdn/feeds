var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();

// Tous les fichiers seront servis depuis le répertoire web
app.use(express.static('web'));

app.get('/feedsList', function (req, res) {
	console.log("feedsList GET");
	db.all("SELECT * FROM Feed", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

app.get('/feedContent', function (req, res) {
	console.log("feedContent GET", req.query);
	db.all("SELECT * FROM FeedContent WHERE IdFeed = " + req.query.id + " ORDER BY PublishedDate DESC", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
})

// app.post('/', function (req, res) {
   // console.log("Got a POST request for the homepage");
   // res.send('Hello POST');
// })

// app.get('/list_user', function (req, res) {
   // console.log("Got a GET request for /list_user");
   // res.send('Page Listing');
// })

// app.get('/ab*cd', function(req, res) {   
   // console.log("Got a GET request for /ab*cd");
   // res.send('Page Pattern Match');
// })


var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Example app listening at http://%s:%s", host, port)
})