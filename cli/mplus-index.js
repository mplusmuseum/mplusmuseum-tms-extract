#!/usr/bin/env node

var config = require('config');
var chalk = require('chalk');
var program = require('commander');
var elasticsearch = require('elasticsearch');

const writerConfig = config.get('data');

program
    .parse(process.argv);

