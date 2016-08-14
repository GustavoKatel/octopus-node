var fs = require('fs');
var SSH = require('ssh2').Client;

class Status {
  constructor(name) {
    this.name = name;
  }

  toString() {
    return `${this.name}`;
  }
}
Status.IDLE = new Status('IDLE');
Status.RUNNING = new Status('RUNNING');
Status.CLOSED = new Status('CLOSED');
Status.CONNECTING = new Status('CONNECTING');
Status.EXITED = new Status('EXITED');

class Process {
  constructor(options) {
    this.id = options.id;
    this.hostname = options.hostname;
    this.port = options.port;
    this.username = options.username;
    this.pkey = options.pkey;
    this.cmd = options.cmd;
    this.stdout = options.stdout;
    this.stderr = options.stderr;

    this.status = Status.IDLE;

    this.exitCode = null;

    this.ssh = null;

    this.stream = null;
  }

  connect(callback) {
    this.ssh = new SSH();

    this.ssh
    .on('error', (err) => {
      console.log(err);
      this.status = Status.CLOSED;
      this.ssh.end();
    })
    .on('close', () => {
      this.status = Status.CLOSED;
    })
    .on('end', () => {
      this.status = Status.CLOSED;
    })
    .on('ready', callback);

    this.ssh.connect({
      host: this.hostname,
      port: this.port,
      username: this.username,
      privateKey: fs.readFileSync(this.pkey)
    });
  }

  interrupt() {
    if(this.status == Status.RUNNING && this.stream) {
      this.stream.write('\x03');
    }
  }

  kill() {
    if(this.status == Status.RUNNING && this.stream) {
      this.stream.signal('KILL');
    }
  }

  run() {

    this.status = Status.CONNECTING;
    this.connect(() => {

      this.stdout.write(`-.-.-00-.-.- ${this.cmd} -.-.-00-.-.-\n`);
      this.stderr.write(`-.-.-00-.-.- ${this.cmd} -.-.-00-.-.-\n`);

      this.ssh.exec(`bash -c \"${this.cmd} #OCTOPUS\"`, {
        pty: true
      }, (err, stream) => {

        if (err) {
          console.log(err);
          return;
        };

        this.status = Status.RUNNING;
        this.stream = stream;

        stream.on('close', (code, signal) => {

          this.status = Status.EXITED;
          this.exitCode = (code!="" || code==0) ? `RET(${code})` : `S(${signal})`;
          this.stdout.write(`-.-.-00-.-.- ${this.cmd} END ${this.exitCode} -.-.-00-.-.-\n\n`);
          this.stderr.write(`-.-.-00-.-.- ${this.cmd} END ${this.exitCode} -.-.-00-.-.-\n\n`);
          this.ssh.end();

        }).on('data', (data) => {

          this.stdout.write(data);

        }).stderr.on('data', (data) => {

          this.stderr.write(data);

        });
      });

    });

  }

  toString() {
    return `\$${this.id} ${this.cmd} - ${this.status} ` +
    ( this.exitCode ? `Exited: ${this.exitCode}` : "" );
  }
}

class Node {

  constructor(options) {

    this.name = options.name || "";
    this.username = options.username || "";
    this.hostname = options.hostname || "";
    this.port = options.port || 22;
    this.pkey = options.pkey || "";

    this.nodesDir = options.nodesDir || fs.mkdtempSync('/tmp/octopus-');

    this.stdout = fs.createWriteStream(`${this.nodesDir}/${this.name}.out`, {
      flags: "a"
    });
    this.stdout.write(new Date().toISOString()+"\n");

    this.stderr = fs.createWriteStream(`${this.nodesDir}/${this.name}.err`, {
      flags: "a"
    });
    this.stderr.write(new Date().toISOString()+"\n");

    this.processList = [];

    this.lastCommand = "";

    this.processLastId = 0;

  }

  runCommand(cmd) {

    this.processLastId = (++this.processLastId % 1000);
    var process = new Process({
      id: this.processLastId,
      cmd: cmd,
      stdout: this.stdout,
      stderr: this.stderr,
      hostname: this.hostname,
      port: this.port,
      username: this.username,
      pkey: this.pkey
    });
    process.run();
    this.processList.push(process);

    if(this.processList.length > 10) {
      this.processList.splice(0, this.processList.length-5);
    }

    this.lastCommand = cmd;

  }

  putFile(src, dst, callback) {

    var ssh = new SSH();

    ssh
    .on('error', (err) => {
      console.log(err);
      ssh.end();
    })
    .on('close', () => {
    })
    .on('end', () => {
    })
    .on('ready', () => {

      ssh.sftp((err, sftp) => {

        if(err) {
          console.log(err);
          return;
        }

        sftp.fastPut(src, dst, (err) => {

          if(err) {
            console.log(err);
          }
          callback(err);

        })

      });

    }).connect({
      host: this.hostname,
      port: this.port,
      username: this.username,
      privateKey: fs.readFileSync(this.pkey)
    });

  }

  getFile(src, dst, callback) {

    var ssh = new SSH();

    ssh
    .on('error', (err) => {
      console.log(err);
      ssh.end();
    })
    .on('close', () => {
    })
    .on('end', () => {
    })
    .on('ready', () => {

      ssh.sftp((err, sftp) => {

        if(err) {
          console.log(err);
          return;
        }

        sftp.fastGet(src, dst, (err) => {

          if(err) {
            console.log(err);
          }
          callback(err);

        })

      });

    }).connect({
      host: this.hostname,
      port: this.port,
      username: this.username,
      privateKey: fs.readFileSync(this.pkey)
    });

  }

  getFileStream(src, callback) {

    var ssh = new SSH();

    ssh
    .on('error', (err) => {
      console.log(err);
      callback(err);
      ssh.end();
    })
    .on('close', () => {
    })
    .on('end', () => {
    })
    .on('ready', () => {

      ssh.sftp((err, sftp) => {

        if(err) {
          console.log(err);
          callback(err);
          return;
        }

        var stream = sftp.createReadStream(src);
        callback(null, stream);

      });

    }).connect({
      host: this.hostname,
      port: this.port,
      username: this.username,
      privateKey: fs.readFileSync(this.pkey)
    });

  }

  getRunningProcesses() {
    return this.processList.filter((process, index) => {
      if(process.status == Status.EXITED || process.status == Status.CLOSED) {
        return false;
      }
      return true;
    });
  }

  toString() {
    return `${this.name} ${this.getRunningProcesses().length}/${this.processList.length}`;
  }

}

module.exports = {
  Node: Node,
  Status: Status,
  Process: Process
}
