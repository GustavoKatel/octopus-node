FROM ubuntu:16.10

RUN apt-get update && apt-get upgrade -y

RUN apt-get install -y wget git

RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.31.2/install.sh | bash

ENV NVM_DIR=/root/.nvm

RUN cd /opt && \
git clone https://github.com/GustavoKatel/octopus-node.git octopus

RUN . $HOME/.nvm/nvm.sh && \
nvm install stable && \
cd /opt/octopus && \
npm install

VOLUME /opt/octopus/conf

COPY entrypoint.sh /opt/octopus/

ENTRYPOINT bash /opt/octopus/entrypoint.sh
