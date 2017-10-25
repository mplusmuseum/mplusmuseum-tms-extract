#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');

program
    .version('1.0.0')

program
    .command('harvest', 'Harvest object data from XML file')

program.parse(process.argv);
