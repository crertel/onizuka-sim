var config = require("./config.js");
var express = require('express');
var zmq = require('zmq');

var assetSub;
var webServer;

function startAssetSub() {
    var assetServerAddress = "tcp://" + config.assetServerAddress + ":" + config.assetServerPort;
    assetSub = zmq.socket('sub');
    console.log("Subscribed to asset server at %s", assetServerAddress);
    assetSub.on('message', function(msg) {
     try {
         var msgObject = JSON.parse(msg);
         console.info('Received message: ');
         console.info( JSON.stringify(msgObject) );
     } catch ( error ) {
         console.warn('Received bad message: \n%s', msg.toString());
     }

    })
    assetSub.subscribe('');
    assetSub.connect(assetServerAddress);

    console.info("done.");
};

function startWeb() {
    var port = config.webPort;
    console.info("Starting sim web server on port %s...", port);
    webServer = express();

    webServer.get('/', function(req, res){
        res.send(config.motd);
    });

    webServer.listen(port);
    console.info("done.");
};

function showConfig() {
    console.info("Using config:");
    console.info(config);
};

function init() {
    showConfig();
    startAssetSub();
    startWeb();
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    console.warn("Shutting down...");
    assetSub.close();
};

init();


