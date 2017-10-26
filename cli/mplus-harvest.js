#!/usr/bin/env node

const getStdin = require('get-stdin');

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

var Harvest = require('../harvest/harvest');
var Writer = require('../writer/writer');

const writerConfig = config.get('data');

program
    .option('-c, --count', 'Retrieve a count of object records in the XML file')
    .option('-o, --outfile <filename>', 'Filename to write data to')
    .parse(process.argv);

if (program.count){
    console.log("Counting");
}

else {

    getStdin().then(data => {
	
	var h = new Harvest(data, config);
	h.harvestObjects().then((res) => {
	    if (program.outfile){
		var writer = new Writer(res, program.outfile, writerConfig);
		writer.writeJson();
	    } else {
		console.log(res);
	    }
	}).catch((err) => {
	    console.log(err);
	});

    });
    
}
