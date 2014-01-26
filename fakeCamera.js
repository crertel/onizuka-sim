var config = require("./config.js");
var zmq = require('zmq');
var _ = require('lodash');
var log4js = require('log4js');
var log = log4js.getLogger();

log.setLevel("WARN");

var cameraPub;

// collection of valid marker IDs
var markers = []
var nextMarkerID = 0;

function startAssetPub() {
    var cameraAddress = "tcp://*"+":"+config.cameraServerPort;
    log.log("Start camera message publication as %s...", config.cameraServerAddress);
    cameraPub = zmq.socket('pub');
    cameraPub.bind(cameraAddress);
    log.log("done.");

    setInterval(function(){
        var mtype = Math.random();
        if (mtype < .1) {            
            markers.push( nextMarkerID );

            // 10% of time, markers enter
            var msg = { t: "cam", st:"ent", d:{id: nextMarkerID } } ;
            nextMarkerID++;
            cameraPub.send(JSON.stringify(msg));
            log.debug("Sending message %s", JSON.stringify(msg));
        } else if (mtype < .2) {
            // 10 % of time, markers leave
            if (markers.length > 0) {
                var mid = _.sample(markers);
                _.pull(markers, mid );
                var msg = { t: "cam", st:"ext", d:{id: mid } } ;
                cameraPub.send(JSON.stringify(msg));
                log.debug("Sending message %s", JSON.stringify(msg));
            }
        } else {
            // 80% of time, markers move
            if (markers.length > 0) {
                var markerID = _.sample(markers);
                var msg = { t: "cam", st:"upd", d:{id: markerID } } ;
                cameraPub.send(JSON.stringify(msg));
                log.debug("Sending message %s", JSON.stringify(msg));
            }
        }
    },50);
};

function showConfig() {
    log.info("Using config:");
    log.info(config);
};

function init() {
    showConfig();
    startAssetPub();
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    log.warn("Shutting down...");
    assetSub.close();
};

init();

