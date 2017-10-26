#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

program
    .version('1.0.0')

program
    .command('harvest', 'Harvest object data from XML file')
    .command('index', 'Update and import data to an ElasticSearch index')

program.parse(process.argv);
