#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

var elasticsearch = require('elasticsearch');

const writerConfig = config.get('data');

program
    .option('-c, --create <name>', 'Create a new index')
    .option('-d, --drop <name>', 'Delete an index')
    .parse(process.argv);


var client = new elasticsearch.Client({
  host: 'localhost:9200',
});


if (program.create) {
    
    client.indices.create({
	index: program.create
    }).then(function (body) {
	console.log(chalk.bold.green(JSON.stringify(body)));
    }, function (error) {
	console.trace(error.message);
    });

}


if (program.drop) {
    
    client.indices.delete({
	index: program.drop
    }).then(function (body) {
	console.log(chalk.bold.red(JSON.stringify(body)));
    }, function (error) {
	console.trace(error.message);
    });

}

