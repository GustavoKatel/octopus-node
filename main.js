var path = require('path');
var fs = require('fs');

var Node = require('./node').Node;
var Telegram = require('./interfaces/telegram').Telegram;

var nodesDir = fs.mkdtempSync('/tmp/octopus-');
fs.mkdirSync(nodesDir+"/data");

var confDir = __dirname + path.sep + 'conf' + path.sep + 'octopus.conf';
var conf = JSON.parse(fs.readFileSync(confDir, 'utf8'));

var nodes = conf.nodes.map((node_conf) => {

  let options = Object.assign({}, node_conf);
  options['pkey'] = conf.auth.private_key;
  options['nodesDir'] = nodesDir;

  return new Node(options);

});

var octopus = {
  conf: conf,
  nodes: nodes,
  nodesDir: nodesDir,

  save: function(callback) {
    fs.writeFile(confDir, JSON.stringify(octopus.conf, null, 4), (err) => {
      callback(err);
    });
  }
};

var telegram = new Telegram(octopus);
