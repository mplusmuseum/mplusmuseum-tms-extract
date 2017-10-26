#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');
var fs = require('fs');
var path = require("path");
var elasticsearch = require('elasticsearch');

const writerConfig = config.get('data');
const p = "data/json/";

program
    .option('-c, --create <name>', 'Create a new index')
    .option('-d, --drop <name>', 'Delete an index')
    .option('-r, --reindex <name>', 'Reindex all objects to the specified index')
    .parse(process.argv);


var client = new elasticsearch.Client({
    host: 'localhost:9200'
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

if (program.reindex) {
    
    client.indices.delete({
	index: program.reindex
    }).then(function (body) {
	console.log(chalk.bold.red(JSON.stringify(body)));
    
	client.indices.create({
	    index: program.reindex
	}).then(function (body) {
	    console.log(chalk.bold.green(JSON.stringify(body)));
	    
	    fs.readdir(p, function (err, files) {
		if (err) {
		    throw err;
		}
		
		files.map(function (file) {
		    return path.join(p, file);
		}).filter(function (file) {
		    return fs.statSync(file).isFile();
		}).forEach(function (file) {
		    console.log("%s (%s)", file, path.extname(file));
		    
		    fs.readFile(file, 'utf-8', function (err, data) {
			if (err) throw err;
			
			client.index({
			    index: 'micah',
			    type: 'object',
			    id: path.basename(file, '.json'),
			    body: data
			}).then(function (body) {
			    console.log(chalk.bold.green(JSON.stringify(body)));
			}, function (error) {
			    console.trace(error.message);
			});
			
		    });
		    
		});
	    });
	    
	}, function (error) {
	    console.trace(error.message);
	});
	
    }, function (error) {
	console.trace(error.message);
    });

}
