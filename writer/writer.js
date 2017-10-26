'use strict';

var fs = require('fs');
var chalk = require('chalk');

class Writer {

    constructor (data, filename, config) {
	this.data = data;
	this.filename = filename;
	this.config = config;
    }


    writeJson() {

	var file = "./" + this.config.json + "/" + this.filename + ".json"; 
	fs.writeFile(file, JSON.stringify(this.data, null, 4), (err) => {
	    if (err) {
		console.error(err);
		return;
	    };
	    console.log(chalk.bold.green("File %s has been created"), this.filename);
	});
    }
}

module.exports = Writer;
