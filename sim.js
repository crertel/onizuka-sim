var config = require("./config.js");
var express = require('express');
var zmq = require('zmq');
var sockjs = require("sockjs");
var log4js = require('log4js');
var log = log4js.getLogger();
log.setLevel('WARN');

var assetSub;
var webServer;
var expressWebServer;
var monitorSocket;

function startAssetSub() {
    var assetServerAddress = "tcp://" + config.assetServerAddress + ":" + config.assetServerPort;
    assetSub = zmq.socket('sub');
    log.info("Subscribed to asset server at %s", assetServerAddress);
    assetSub.on('message', function(msg) {
     try {
         var msgObject = JSON.parse(msg);
         var msgObjectString = JSON.stringify(msgObject);
         try {
             operators.forEach( function(conn) {
                 conn.write(msgObjectString);
             });
         } catch (error) {
             log.warn("Unable to send to operator: ", error.toString());
         }
         log.debug('Received message: ');
         log.debug( msgObjectString );
     } catch ( error ) {
         log.warn('Received bad message: \n%s', msg.toString());
     }

    });
    assetSub.subscribe('');
    assetSub.connect(assetServerAddress);

    log.info("done.");
};

var operators = [];

function startMonitor(){
    log.info("Starting monitor...");
    monitorSocket = sockjs.createServer();
    monitorSocket.on('connection', function(conn) {
        operators.push(conn);
        log.log("Operator joined.");
        conn.on('data', function(message) {
            log.info("Operator says %s", message);
        });
        conn.on('close', function () {
            var opIndex;
            opIndex = operators.indexOf(conn);
            if (opIndex != -1) {
                operators.splice(opIndex,1);
            }
            log.info("Operator left.");
        });
    });
    monitorSocket.on('close', function(conn) {
    });
    monitorSocket.installHandlers(expressWebServer, {prefix:'/console'});
    log.info("done.");
};

function startWeb() {
    var port = config.webPort;
    log.info("Starting sim web server on port %s...", port);
    webServer = express();

    webServer.use(express.static(__dirname + '/web'));
    expressWebServer = webServer.listen(port);
    log.info("done.");
};

function showConfig() {
    log.info("Using config:");
    log.info(config);
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
    log.warn("Shutting down...");
    assetSub.close();
};

init();
