var express = require('express');
var sqlite = require("sqlite3");
var db = new sqlite.Database('feeds.sqlite');
var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/allCategoriesList', function (req, res) {
	console.log(new Date(), "allCategoriesList GET ", req.query);
	db.all("SELECT \
		IdCategory, \
		Name, \
		0 ShowEmptyFeeds,\
        0 Fold\
	FROM Category \
	WHERE IdUser=1\
	ORDER BY Name", function(e,rows){
		if(e) throw e;
		res.json(rows);
	});
});

var server = app.listen(8181, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Feeds API listening at http://%s:%s", host, port)
})
