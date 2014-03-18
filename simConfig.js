var config = {};

config.motd = "Hello, world!";
config.operatorMotd = "Welcome to the Onizuka Asset Sim! Server started up at: " + (new Date()).toString();
config.version = "0.1.0";
config.webPort = 3000;

config.assetServerAddress = "localhost";
config.assetServerPort = 4001;

config.cameraListenPort = 4002;

module.exports = config;
