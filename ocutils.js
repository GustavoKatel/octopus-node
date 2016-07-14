module.exports = {

  match: function(regex, text, callback) {

    var match = regex.exec(text);
    if(match && callback) {
      callback(match);
    }

  }

}
