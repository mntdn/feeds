var server = require('http').createServer();
var io = require('socket.io')(server);
io.on('connection', function(client){
    client.on('event', function(data){});
    client.on('disconnect', function(){});
    client.on('updateFeed', function(data){
        client.broadcast.emit('updateFeed', data);
    });
});
server.listen(3000);
