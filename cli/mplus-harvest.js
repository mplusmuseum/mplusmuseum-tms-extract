#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

program
    .option('-c, --count', 'Retrieve a count of object records in the XML file')
    .option('-f, --filename', 'XML file to process')
    .parse(process.argv);

if (program.count){
    console.log("Counting");
}

else {
    require('../harvest/harvest.js').harvest(
	arguments
    )
}
