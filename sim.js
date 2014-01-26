var config = require("./config.js");

var path = require('path');
var express = require('express');
var zmq = require('zmq');
var sockjs = require("sockjs");
var log4js = require('log4js');
var log = log4js.getLogger();


//log.setLevel('INFO');

var messageDispatch = require('./messageDispatch');

var assetSub;
var webServer;
var expressWebServer;
var monitorSocket;

function runScriptFromFile( filename ) {
    var scriptPath = path.join(__dirname,"scripts",filename);
    log.info("Running script %s", scriptPath );
};

function broadcastOperators ( msg ) {
     try {
         // notify operators
         operators.forEach( function(conn) {
             if (conn.showMessages) {
                 conn.write(msg);
             }
         });
     } catch (error) {
         log.warn("Unable to send to operator: ", error.toString());
     }
};

function startAssetSub() {
    var assetServerAddress = "tcp://" + config.assetServerAddress + ":" + config.assetServerPort;
    assetSub = zmq.socket('sub');
    log.info("Subscribed to asset server at %s", assetServerAddress);
    assetSub.on('message', function(msg) {
     try {
         var msgObject = JSON.parse(msg);
         log.debug('Received message: ');
         log.debug( msgObject );
         broadcastOperators(msgObject);
         messageDispatch.dispatchMessage(msgObject);
     } catch ( error ) {
         log.warn('Received bad message: \n%s', msg.toString());
     }

    });
    assetSub.subscribe('');
    assetSub.connect(assetServerAddress);

    log.info("done.");
};
function startCameraSub() {
    var cameraServerAddress = "tcp://" + config.cameraServerAddress + ":" + config.cameraServerPort;
    cameraSub = zmq.socket('sub');
    log.info("Subscribed to camera server at %s", cameraServerAddress);
    cameraSub.on('message', function(msg) {
     try {
         var msgObject = JSON.parse(msg);
         log.debug('Received message: ');
         log.debug( msgObject );
         broadcastOperators(msgObject);
         messageDispatch.dispatchMessage(msgObject);
     } catch ( error ) {
         log.warn('Received bad message: \n%s', msg.toString());
     }

    });
    cameraSub.subscribe('');
    cameraSub.connect(cameraServerAddress);

    log.info("done.");
};

var operators = [];
var operatorCommands = {
    showMessages: function () {
        return function (conn) {
            conn.showMessages = true;
        }
    },
    hideMessages: function () {
        return function (conn) {
        conn.showMessages = false;
        }
    },

    runScript: function (filename) {
        return function (conn) {
            runScriptFromFile(filename);
        }
    }
};

function startMonitor(){
    log.info("Starting monitor...");
    monitorSocket = sockjs.createServer();
    monitorSocket.on('connection', function(conn) {
        operators.push(conn);
        log.log("Operator joined.");
        conn.on('data', function(message) {
            log.info("Operator says %s", message);
            with(operatorCommands) {
                try {
                    var command = eval(message);
                    command(conn);
                } catch (e) {
                    log.warn("Unrecognized command %s", message);
                }
            }
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
    startCameraSub();
    
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    log.warn("Shutting down...");
    assetSub.close();
};

init();
