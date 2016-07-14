# OCToPUS -.-00-.-

### Manage, control and execute software across slaves through secure shell channels

### 1 - Installation

* Get the code

            git clone https://github.com/GustavoKatel/octopus-node.git

* Dependencies

            npm install


### 2 - Create a Telegram bot

  - See [Telegram bots](https://core.telegram.org/bots)

  - Paste the bot token in `conf/octopus.conf`

  ```
  "telegram": {
    "token": "TELEGRAM_BOT_TOKEN" <-------- PLACE IT HERE
  }
  ```

  - Configure the access control
  ```
  "telegram": {
    "admins": [
        "ADMIN1" <------- ADD NEW ADMINISTRATORS
    ],
    "token": "TELEGRAM_BOT_TOKEN"
  }
  ```

### 3 - Generate SSH keys

    $ ssh-keygen

  - Result sample
  ```
  Generating public/private rsa key pair.
Enter file in which to save the key (/home/gustavokatel/.ssh/id_rsa): mykeypair
  ```
  - Set the private key in `conf/octopus.conf`

  ```
  "auth": {
      "private_key": "/opt/octopus/conf/mykeypair" <---- PLACE IT HERE
  },
  ```

  - Insert the public key in every slave

        cat mykeypair.pub >> /home/$USER/.ssh/authorized_keys

## License

See LICENSE

## Author

[GustavoKatel](http://gsampaio.info)
