#!/usr/bin/env node

const getStdin = require('get-stdin')

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

var Harvest = require('../harvest/harvest');

program
    .option('-c, --count', 'Retrieve a count of object records in the XML file')
    .option('-o, --outfile', 'Filename to write data to')
    .parse(process.argv);

if (program.count){
    console.log("Counting");
}

else {

    getStdin().then(data => {
	
	var h = new Harvest(data, config);
	h.harvestObjects().then((res) => {
	    console.log(res);
	}).catch((err) => {
	    console.log(err);
	});

    });
    
}
