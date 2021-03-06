var config = require("./simConfig.json");

var path = require('path');
var express = require('express');
var zmq = require('zmq');
var sockjs = require("sockjs");
var log4js = require('log4js');
var log = log4js.getLogger("sim");


log.setLevel('INFO');

var messageDispatch = require('./messageDispatch');

var assetSub;
var cameraPull;
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

function handleMessageText(msg) {
     try {
         var msgObject = JSON.parse(msg);
         messageDispatch.dispatchMessage(msgObject);
         broadcastOperators(msg);
     } catch ( error ) {
         log.warn('Received bad message: \n%s', msg.toString());
     }
}

function startAssetSub() {
    var assetServerAddress = "tcp://" + config.assetServerAddress + ":" + config.assetServerPort;
    assetSub = zmq.socket('sub');
    log.info("Subscribed to asset server at %s", assetServerAddress);
    assetSub.on('message', handleMessageText);
    assetSub.subscribe('');
    assetSub.connect(assetServerAddress);

    log.info("done.");
};
function startCameraPull() {
    var cameraClientAddress = "tcp://*:" + config.cameraListenPort;
    cameraPull = zmq.socket('pull');
    log.info("Subscribed to camera server at %s", cameraClientAddress);
    cameraPull.on('message', handleMessageText);
    cameraPull.bind(cameraClientAddress);

    log.info("done.");
};

var operators = [];
var operatorCommands = {
    help: function() {
        return function (conn) {
            conn.write("Operator commands:\n");
            conn.write("\tshowMessages() -- Enables snooping of system messages.\n");
            conn.write("\thideMessages() -- Disables snooping of system messages.\n");
            conn.write("\tinjectMessages( <msg> ) -- Injects into messaging fabric a given message.\n");
            conn.write("\trunScript( <filename> ) -- Executes a script from the server.\n");
            conn.write("\tsay( <message> ) -- Says a messsage to other ops.\n");
            conn.write("\tsetName( <new name> ) -- Sets op name to new name.\n");
        }
    },
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

    injectMessage: function(msg) {
        return function (conn) {
            handleMessageText(msg);    
        }
    },

    runScript: function (filename) {
        return function (conn) {
            runScriptFromFile(filename);
        }
    },

    say : function (message) {
        return function (conn) {
            log.info("Operator " + conn.opName + " says: " + message);
            operators.forEach( function(op) {
                op.write("Operator "+ conn.opName +" says: "+ message);
            });
        }
    },

    setName : function (newName) {
        return function (conn) {
            log.info("Operator "+ conn.opName +" now known as "+ newName);
            operators.forEach( function(op) {
                op.write("Operator "+ conn.opName +" now known as "+ newName);
            });
            conn.opName = newName;
        }
    }
};

function startMonitor(){
    log.info("Starting monitor...");
    monitorSocket = sockjs.createServer();
    monitorSocket.on('connection', function(conn) {
        operators.push(conn);
        log.info("Operator joined.");
        conn.write(config.operatorMotd || "Welcome!");
        conn.on('data', function(message) {
            log.info("Operator says %s", message);
            with(operatorCommands) {
                try {
                    var command = eval(message);
                    command(conn);
                } catch (e) {
                    conn.write("Unrecognized command " + message);
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
    startCameraPull();
    
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    log.warn("Shutting down...");
    assetSub.close();
};

init();
