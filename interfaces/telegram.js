var fs = require('fs');
var path = require('path');
var TelegramBot = require('node-telegram-bot-api');

var ocu = require('../ocutils');
var Status = require('../node').Status;
var Node = require('../node').Node;

class Telegram {

  constructor(octopus) {

    this.octopus = octopus;
    this.bot = new TelegramBot(octopus.conf.telegram.token, {polling: true});

    this.defaultSendOptions = { };

    this.bot.on('callback_query', (message) => {

      var chatId = message.message.chat.id;

      if(this.octopus.conf.telegram.admins.indexOf(message.from.username)<0) {
        this.sendMessage(chatId, `-.-.-00-.-.-
>>> OCToPUS <<<<
-.-.-00-.-.-`);
        return;
      }

      var data = message.data;

      console.log(`[Telegram][${chatId}]: ${data}`);
      this.interpreter(chatId, data);

    });

    this.bot.on('document', (message) => {

      var chatId = message.chat.id;

      if(this.octopus.conf.telegram.admins.indexOf(message.from.username)<0) {
        this.sendMessage(chatId, `-.-.-00-.-.-
>>> OCToPUS <<<<
-.-.-00-.-.-`);
        return;
      }

      this.bot.downloadFile(message.document.file_id, `${this.octopus.nodesDir}/data`)
        .then(filePath => {

          this.octopus.nodes.forEach(node => {

            this.sendMessage(chatId, `Uploading ${message.document.file_name} to ${node.name}...`);
            node.putFile(filePath, message.document.file_name, (err) => {
              if(err) {
                this.sendMessage(chatId, `Error trying to upload ${message.document.file_name} to ${node.name}`);
              }
            });

          });

          this.sendMessage(chatId, "-.-.-00-.-.-");

        });

    });

    this.bot.onText(/\/(.+)/, (message, match) => {

      var chatId = message.chat.id;

      if(this.octopus.conf.telegram.admins.indexOf(message.from.username)<0) {
        this.sendMessage(chatId, `-.-.-00-.-.-
>>> OCToPUS <<<<
-.-.-00-.-.-`);
        return;
      }

      var text = match[1];
      console.log(`[Telegram][${chatId}]: ${text}`);
      this.interpreter(chatId, text, message);
    });

  }

  sendMessage(chatId, text, options) {
    return this.bot.sendMessage(chatId,
      text,
      Object.assign({}, this.defaultSendOptions, options));
  }

  sendQuestion(chatId, question, callback) {
    this.bot.sendChatAction(chatId, "typing");

    var options = {
      reply_markup: {
        force_reply: true
      }
    };
    this.bot.sendMessage(chatId, question, options)
      .then((sended) => {
        var sChatId = sended.chat.id;
        var sMessageId = sended.message_id;
        this.bot.onReplyToMessage(sChatId, sMessageId, (message) => {

          if(message.text.trim() == "") {
            this.sendQuestion(chatId, `Not valid! ${question}`, callback);
            return;
          } else if(message.text.trim() == "/cancel") {
            this.sendMessage(chatId, "-.-.-00-.-.-");
            return;
          }
          callback(message.text);

        });
      });

  }

  interpreter(chatId, text, message) {

    // /start
    ocu.match(/start$/g, text, (match) => {

      var options = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "System information", callback_data: "/info" },
              { text: "Node information", callback_data: "/infoNode" }
            ],
            [
              { text: "Execute command", callback_data: "/execNode" },
              { text: "Read logs", callback_data: "/logsNode" }
            ],
            [
              { text: "Download file", callback_data: "/downloadNode" },
              { text: "Kill process", callback_data: "/killNode" }
            ],
            [
              { text: "Add admin", callback_data: "/auth" },
              { text: "Add node", callback_data: "/addNode" }
            ],
            [
              { text: "Download logs", callback_data: "/dumpNode" }
            ],
            [
              { text: "Help", callback_data: "/help" }
            ]
          ]
        }
      };
      this.bot.sendMessage(chatId, '>>> OCToPUS <<<<', options);

    });

    // /info
    ocu.match(/info$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      var res = "Nodes list starts -.-.-00-.-.-\n\n"
      var processTotal = 0;
      this.octopus.nodes.forEach((node, index) => {

        processTotal += node.getRunningProcesses().length;
        res += `${index} - ${node}\n`;

      });

      res += `\nTotal of ${processTotal} process(es) runnning\n`;

      res += "\nNodes list ends -.-.-00-.-.-\n"
      this.sendMessage(chatId, res);

    });

    // /infoNode
    ocu.match(/infoNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      var options = {
        reply_markup: {
          inline_keyboard: this.octopus.nodes.map((node) => {
              return [{ text: node.name, callback_data: `/info ${node.name}` }];
          })
        }
      };
      this.sendMessage(chatId, 'Get info from:', options);

    });

    // /info NODE_NAME
    ocu.match(/info ([a-zA-Z0-9_]+)/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      var res = "";
      this.octopus.nodes.forEach((node) => {
        if(node.name == match[1]) {
          res += `Node info: ${node.name} -.-.-00-.-.-\n\n`;
          res += `hostname: ${node.hostname}\n`;
          res += `username: ${node.username}\n`;
          res += `port: ${node.port}\n`;
          res += `last command: ${node.lastCommand}\n`;
          res += `Process count: ${node.getRunningProcesses().length}/${node.processList.length}\n`;
          res += "Process List:\n"
          node.processList.forEach((process, index) => {
            res += `#${index} ${process}\n`;
          });
          res += "\n"
          res += "\nNode info ends -.-.-00-.-.-\n"
        }
      });

      this.sendMessage(chatId, res)

    });

    // /executeNode
    ocu.match(/execNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      this.sendQuestion(chatId, 'Enter the list of nodes (Comma separated)\n* = All nodes\nExample: node1,node2', text => {

        var sText = text.replace(/,\s+/g, ",");
        ocu.match(/[-\w,\*]+/g, sText, (match) => {

          this.sendQuestion(chatId, 'Enter the command', text => {
            this.interpreter(chatId, `exec ${sText} ${text}`);
          });

        });

      });

    });

    // /exec LIST_OF_NAMES|* CMD
    ocu.match(/exec ([a-zA-Z0-9_,]+|\*) (.+)/g, text, (match) => {

      var names = match[1].replace(/,\s+/g, ",").split(",");
      var cmd = match[2];

      this.bot.sendChatAction(chatId, "typing");
      var all = names.indexOf("*")>=0;
      this.octopus.nodes.forEach((node, index) => {

        if(all || names.indexOf(node.name)>=0) {
          node.runCommand(cmd);
        }

      });

      this.sendMessage(chatId, "-.-.-00-.-.-");

    });

    // /logsNode
    ocu.match(/logsNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      var buttons = this.octopus.nodes.map((node) => {
        return [ { text: node.name, callback_data: `/logs ${node.name}` } ];
      });

      var options = {
        reply_markup: {
          inline_keyboard: buttons
        }
      };
      this.sendMessage(chatId, 'Read logs from:', options);

    });

    // /logs LIST_OF_NAMES|*
    ocu.match(/logs ([a-zA-Z0-9_,]+|\*)/g, text, (match) => {

      var names = match[1].replace(/,\s+/g, ",").split(",");

      this.bot.sendChatAction(chatId, "typing");
      var all = names.indexOf("*")>=0;
      this.octopus.nodes.forEach((node, index) => {

        if(all || names.indexOf(node.name)>=0) {

          fs.readFile(`${this.octopus.nodesDir}/${node.name}.out`, (err, data) => {
            if (err) console.log(err);;
            var res = `Reading logs: ${node.name} -.-.-00-.-.-\n\n`;
            res += (`${data}`).substr(Math.max(data.length-400, 0), data.length);
            res += `\nReading logs ends: ${node.name} -.-.-00-.-.-\n\n`;
            this.sendMessage(chatId, res);
          });

        }

      });

    });

    // /downloadNode
    ocu.match(/downloadNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      this.sendQuestion(chatId, 'Enter the list of nodes (Comma separated)\n* = All nodes\nExample: node1,node2', text => {

        var sText = text.replace(/,\s+/g, ",");
        ocu.match(/[-\w,\*]+/g, text, (match) => {

          this.sendQuestion(chatId, 'Enter the file path', text => {
            this.interpreter(chatId, `download ${sText} ${text}`);
          });

        });

      });

    });

    // /download LIST_OF_NAMES|* FILE_PATH
    ocu.match(/download ([a-zA-Z0-9_,]+|\*) (.+)/g, text, (match) => {

      var names = match[1].replace(/,\s+/g, ",").split(",");
      var filePath = match[2];

      var all = names.indexOf("*")>=0;
      this.octopus.nodes.forEach((node, index) => {

        if(all || names.indexOf(node.name)>=0) {

          this.bot.sendChatAction(chatId, "upload_document");
          this.sendMessage(chatId, `Downloading ${filePath} from ${node.name}...`);
          var parsed = path.parse(filePath);
          var dst = `${this.octopus.nodesDir}/data/${parsed.name}_${node.name}${parsed.ext}`;
          node.getFile(filePath, dst, (err) => {

            if(err) {
              this.sendMessage(chatId, `Error downloading ${filePath} from ${node.name}...`);
              return;
            }
            this.bot.sendDocument(chatId, dst, {
              caption: `${filePath} from ${node.name}`
            });

          });

        }

      });

    });

    // /killNode
    ocu.match(/killNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      var options = {
        reply_markup: {
          inline_keyboard: [
            this.octopus.nodes.map((node) => {
              return { text: `${node.name} (#${node.getRunningProcesses().length})`, callback_data: `/kill ${node.name}` };
            })
          ]
        }
      };
      this.sendMessage(chatId, 'Kill process from:', options);

    });

    // /kill NODE_NAME
    ocu.match(/kill ([a-zA-Z0-9_]+)$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      var res = "";
      this.octopus.nodes.forEach((node) => {
        if(node.name == match[1]) {

          var options = {
            reply_markup: {
              inline_keyboard: node.getRunningProcesses().map((process) => {
                  return [{ text: `${process}`, callback_data: `/kill ${node.name} ${process.id}` }];
              })
            }
          };
          this.sendMessage(chatId, 'Choose the process:', options);

        }
      });

    });

    // /kill NODE_NAME ID
    ocu.match(/kill ([a-zA-Z0-9_]+) ([0-9]+)$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      var res = "";
      this.octopus.nodes.forEach((node) => {
        if(node.name == match[1]) {

          node.processList.forEach((process) => {
            if(process.id == match[2]) {
              process.interrupt();
              process.kill();
              this.sendMessage(chatId, `Killing process #${process.id} from ${node.name}`);
            }
          });
          this.sendMessage(chatId, '-.-.-00-.-.-');

        }
      });

    });

    // /auth
    ocu.match(/auth$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      this.sendQuestion(chatId, 'Enter the username of the new admin', text => {

        ocu.match(/([-\w]+)/g, text, (match) => {

          var username = match[1];
          this.octopus.conf.telegram.admins.push(username);
          this.octopus.save(() => {
            this.sendMessage(chatId, 'New admin added!');
          });

        });

      });

    });

    // /addNode
    ocu.match(/addNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");

      var node = {};
      this.sendQuestion(chatId, "Enter the name of the new node", (name) => {

        node.name = name;
        this.sendQuestion(chatId, "Ender the hostname/address", (hostname) => {

          node.hostname = hostname;
          this.sendQuestion(chatId, "Enter the port", (port) => {

            node.port = port;
            this.sendQuestion(chatId, "Enter the username", (username) => {

              node.username = username;
              this.octopus.conf.nodes.push(node);
              let options = Object.assign({}, node);
              options['pkey'] = this.octopus.conf.auth.private_key;
              options['nodesDir'] = this.octopus.nodesDir;

              this.octopus.nodes.push(new Node(options));
              this.octopus.save((err) => {
                if(err) {
                  this.sendMessage(chatId, "Error while trying to save conf");
                } else {
                  this.sendMessage(chatId, "-.-.-00-.-.-");
                }
              });

            });

          })

        });

      });

    });

    // /dumpNode
    ocu.match(/dumpNode$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      this.sendQuestion(chatId, 'Enter the list of nodes (Comma separated)\n* = All nodes\nExample: node1,node2', text => {

        var sText = text.replace(/,\s+/g, ",");
        ocu.match(/[-\w,\*]+/g, text, (match) => {

          this.sendQuestion(chatId, 'STDOUT or STDERR?', text => {
            this.interpreter(chatId, `dump ${sText} ${text.toLowerCase()}`);
          });

        });

      });

    });

    // /dump LIST_OF_NAMES|* STDOUT|STDERR
    ocu.match(/dump ([a-zA-Z0-9_,]+|\*) (stdout|stderr)/g, text, (match) => {

      var names = match[1].replace(/,\s+/g, ",").split(",");
      var dumpType = match[2];

      var all = names.indexOf("*")>=0;
      this.octopus.nodes.forEach((node, index) => {

        if(all || names.indexOf(node.name)>=0) {

          this.bot.sendChatAction(chatId, "upload_document");
          this.sendMessage(chatId, `Uploading ${dumpType} from ${node.name}...`);
          var ext = (dumpType == "stdout" ? "out" : "err");
          var src = `${this.octopus.nodesDir}/${node.name}.${ext}`;
          this.bot.sendDocument(chatId, src, {
            caption: `${dumpType} from ${node.name}`
          });

        }

      });

    });


    // /help
    ocu.match(/help$/g, text, (match) => {

      this.bot.sendChatAction(chatId, "typing");
      this.sendMessage(chatId, this.help());
    });

  } // END INTERPRETER

  help() {
    return `
-.-.-00-.-.-
>>> OCToPUS <<<<
-.-.-00-.-.-

Commands:
/info: Returns the list of nodes in the server

/info NAME: Returns information about a specif node

/exec LIST_OF_NAMES|* CMD: Execute the command CMD. Eg.: /exec [s1,s2] ls -lah

/logs LIST_OF_NAMES|*: Read the stdout from the node

/download LIST_OF_NAMES|* FILENAME: Download FILENAME from a node

/auth USERNAME: Add USERNAME to the admin group

/addNode: Add a new node to the network

/kill LIST_OF_NAMES|* ID: Kill process ID from the nodes in LIST_OF_NAMES

/dump LIST_OF_NAMES|* STDOUT|STDERR: Download the stdout or the stderr from a node

/cancel: Cancel the current flow
    `;
  }

}

module.exports = {
  Telegram: Telegram
}
