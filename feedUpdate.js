var feedRead = require("feed-read");
var sqlite = require("sqlite3");

var db = new sqlite.Database('feeds.sqlite');

var table_init = false;

if(table_init){
	db.serialize(function() {  
		db.run("DROP TABLE IF EXISTS Feed;");
		db.run("DROP TABLE IF EXISTS FeedContent;");
		db.run("CREATE TABLE IF NOT EXISTS Feed(IdFeed INTEGER PRIMARY KEY, Url TEXT, Name TEXT); ");
		db.run("CREATE TABLE IF NOT EXISTS FeedContent(IdFeed INTEGER, PublishedDate INTEGER, Title TEXT, Content TEXT, Url TEXT, Author TEXT);");  

		var stmt = db.prepare("INSERT INTO Feed VALUES (NULL,?,?)");  
		stmt.run('http://www.psychologyofgames.com/feed/', 'Psycho');
		stmt.run('http://feeds2.feedburner.com/IndependentGaming', 'IG');
		stmt.finalize();  
	});    
	db.close();
} else {
	db.all("SELECT * FROM Feed", function(e,rows){
		if(e) throw e;
		rows.forEach(function(feed){
			console.log(feed.IdFeed, feed.Url, feed.Name);
			feedRead(feed.Url, function(err, articles){
				if(err) throw err;
				// var stmt = db.prepare("INSERT INTO FeedContent VALUES (?,?,?,?,?,?)");  
				// articles.forEach(function(article){
					// stmt.run(feed.IdFeed, article.published, article.title, article.content, article.link, article.author);
				// });
				// stmt.finalize();
				db.all("SELECT * FROM FeedContent WHERE IdFeed = " + feed.IdFeed + " ORDER BY PublishedDate DESC LIMIT 1", function(e2, content){
					if(e2) throw e2;
					console.log("date ",content[0].PublishedDate);
					if(articles.length > 0){
						// on regarde si l'article le plus récent en base correspond au plus récent dans le fil RSS
						if(Date.parse(articles[0].published) != content[0].PublishedDate && articles[0].title != content[0].Title){
							var stmt = db.prepare("INSERT INTO FeedContent VALUES (?,?,?,?,?,?)");  
							// dans ce cas, on n'est pas à jour
							console.log(feed.Name, "Pas à jour");
							stmt.run(feed.IdFeed, articles[0].published, articles[0].title, articles[0].content, articles[0].link, articles[0].author);
							var i = 1;
							while(articles.length > i && Date.parse(articles[i].published) != content[0].PublishedDate && articles[i].title != content[0].Title){
								console.log(articles[i].published + " -- " + content[0].PublishedDate);
								stmt.run(feed.IdFeed, articles[i].published, articles[i].title, articles[i].content, articles[i].link, articles[i].author);
								i++;							
							}
							stmt.finalize();  
						} else {
							console.log(feed.Name, "A jour");
						}
					}
				});
			});
		});
	});
}

/*
function compareFeeds(a, b) {
	if (a.feed.published < b.feed.published) {
		return -1;
	}
	if (a.feed.published > b.feed.published) {
		return 1;
	}
	// a must be equal to b
	return 0;
}

listOfFeeds.forEach(function(feed){
	var fileName = "savedFeeds/"+feed.file+".json";
	// on essaie d'abord de voir si le feed a été sauvegardé
	fs.access(fileName, fs.R_OK | fs.W_OK, function (err) {
  		if(!err){
			// le fichier existe, on le déserialise et on vérifie si on est à jour
			fs.readFile(fileName, function (err, jsonFile) {
				if (err) throw err;
				var jsonFeed = JSON.parse(jsonFile);
				jsonFeed.sort(compareFeeds);
				// console.log(feed.file + " - " + jsonFeed[0].published);
				feedRead(feed.url, function(err, articles){
					if(err) throw err;
					console.log("Avant sort");
					articles.forEach(function(a){console.log(a.published);})
					articles.sort(compareFeeds);
					console.log("Après sort");
					articles.forEach(function(a){console.log(a.published);})
					console.log(feed.file + " - " + articles[0].published);
					if(Date.parse(articles[0].published) == Date.parse(jsonFeed[0].published) && articles[0].title == jsonFeed[0].title){
						console.log(feed.file + " à jour !");
					}
					else {
						console.log(feed.file + " pas à jour ! -- " + jsonFeed.length);
						console.log(articles[0].published + " -D- " + jsonFeed[0].published)
						console.log(Date.parse(articles[0].published) + " -- " + Date.parse(jsonFeed[0].published))
						jsonFeed.push(articles[0]);
						var i = 1;
						while(articles.length > i && Date.parse(articles[i].published) != Date.parse(jsonFeed[0].published) && articles[i].title != jsonFeed[0].title){
							console.log(Date.parse(articles[i].published) + " -- " + Date.parse(jsonFeed[0].published))
							jsonFeed.push(articles[i]);							
							i++;							
						}
						console.log(feed.file + " maintenant à jour ! -- " + jsonFeed.length);
						fs.writeFile(fileName, JSON.stringify(jsonFeed), function(err) {
							if(err) {
								return console.log(err);
							}
							console.log("OK pour " + (articles.length > 0 ? articles[0].feed.name : feed.file));
						});
					}
				});
			});
		} else {
			// le fichier n'existe pas, il faut le créér
			feedRead(feed.url, function(err, articles){
				if(err) throw err;
				fs.writeFile(fileName, JSON.stringify(articles), function(err) {
					if(err) {
						return console.log(err);
					}
					console.log("Création de " + (articles.length > 0 ? articles[0].feed.name : feed.file));
				});
			});
		}
	});
});*/