var server = require('http').createServer();
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('server.config.json', 'utf8'));

// let's get the port to use for the Socket server
var re = /.*:(\d+)/g.exec(config.socketHost);
if(re.length > 0){
    var io = require('socket.io')(server);
    io.on('connection', function(client){
        client.on('event', function(data){});
        client.on('disconnect', function(){});
        client.on('updateFeed', function(data){
            client.broadcast.emit('updateFeed', data);
        });
    });
    server.listen(re[1]);
}
