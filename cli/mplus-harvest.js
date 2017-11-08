#!/usr/bin/env node

const getStdin = require('get-stdin');

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

var Harvest = require('../harvest/harvest');
var Writer = require('../writer/writer');

const writerConfig = config.get('data');

program
    .option('-c, --count < <path>', 'Retrieve a count of object records in a given XML file.')
    .option('-s, --save', 'Save individual JSON objects to disk')
    .parse(process.argv);

getStdin().then(data => {

    var harvest = new Harvest(data, config);
    harvest.harvestObjects().then((res) => {
	if (program.save){
	    json = JSON.parse(res);

	    for (var i = 0, len = json.length; i < len; ++i) {
		var writer = new Writer(json[i], json[i]['id']+'.json', writerConfig);
		writer.writeJson();
	    }

	} else if (program.count) {
	    console.log(chalk.bold.green("There are %s objects."), JSON.parse(res).length);
	} else {
	    console.log(res);
	}
    }).catch((err) => {
	console.log(err);
    });

});

