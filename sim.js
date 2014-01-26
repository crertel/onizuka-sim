var config = require("./config.js");
var express = require('express');
var zmq = require('zmq');
var sockjs = require("sockjs");

var assetSub;
var webServer;
var expressWebServer;
var monitorSocket;

function startAssetSub() {
    var assetServerAddress = "tcp://" + config.assetServerAddress + ":" + config.assetServerPort;
    assetSub = zmq.socket('sub');
    console.log("Subscribed to asset server at %s", assetServerAddress);
    assetSub.on('message', function(msg) {
     try {
         var msgObject = JSON.parse(msg);
         var msgObjectString = JSON.stringify(msgObject);
         try {
             operators.forEach( function(conn) {
                 conn.write(msgObjectString);
             });
         } catch (error) {
             console.warn("Unable to send to operator: ", error.toString());
         }
         console.info('Received message: ');
         console.info( msgObjectString );
     } catch ( error ) {
         console.warn('Received bad message: \n%s', msg.toString());
     }

    });
    assetSub.subscribe('');
    assetSub.connect(assetServerAddress);

    console.info("done.");
};

var operators = [];

function startMonitor(){
    console.info("Starting monitor...");
    monitorSocket = sockjs.createServer();
    monitorSocket.on('connection', function(conn) {
        operators.push(conn);
        console.log("Operator joined.");
        conn.on('data', function(message) {
            console.info("Operator says %s", message);
        });
        conn.on('close', function () {
            var opIndex;
            opIndex = operators.indexOf(conn);
            if (opIndex != -1) {
                operators.splice(opIndex,1);
            }
            console.info("Operator left.");
        });
    });
    monitorSocket.on('close', function(conn) {
    });
    monitorSocket.installHandlers(expressWebServer, {prefix:'/console'});
    console.info("done.");
};

function startWeb() {
    var port = config.webPort;
    console.info("Starting sim web server on port %s...", port);
    webServer = express();

    webServer.use(express.static(__dirname + '/web'));
    expressWebServer = webServer.listen(port);
    console.info("done.");
};

function showConfig() {
    console.info("Using config:");
    console.info(config);
};

function init() {
    showConfig();
    startWeb();
    startMonitor();
    startAssetSub();
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    console.warn("Shutting down...");
    assetSub.close();
};

init();
