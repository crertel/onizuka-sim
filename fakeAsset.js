var config = require("./config.js");
var zmq = require('zmq');

var assetSub;

function startAssetPub() {
    var assetAddress = "tcp://*"+":"+config.assetServerPort;
    console.info("Start asset message publication as %s...", assetAddress);
    assetPub = zmq.socket('pub');
    assetPub.bind(assetAddress);
    console.info("done.");
    setInterval(function(){
        var msg = { t: "asset", st:"add", d:Math.random()} ;
        console.log("Sending message %s", JSON.stringify(msg));
        assetPub.send(JSON.stringify(msg));
    },50);
};

function showConfig() {
    console.info("Using config:");
    console.info(config);
};

function init() {
    showConfig();
    startAssetPub();
    process.on('SIGINT', shutdown);
    process.on("quit", shutdown);
};

function shutdown() {
    console.warn("Shutting down...");
    assetSub.close();
};

init();


