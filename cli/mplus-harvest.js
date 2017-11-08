#!/usr/bin/env node

const fs = require('fs');
var config = require('config');
var chalk = require('chalk');
var program = require('commander');

var Harvest = require('../harvest/harvest');
var Writer = require('../writer/writer');

const writerConfig = config.get('data');

program
  .option('-c, --count <path>', 'Retrieve a count of object records in a given XML file.')
  .option('-s, --save <path>', 'Save individual JSON objects to disk.')
  .parse(process.argv);

const filePath = program.count || program.save;

fs.readFile(filePath, 'utf8', (err, data) => {
  var harvest = new Harvest(data, config);
  harvest.harvestObjects().then((res) => {
    const json = JSON.parse(res);
    if (program.count) {
      console.log(chalk.bold.green("There are %s objects."), json.length);
    } else if (program.save) {
      for (var i = 0; i < json.length; i++) {
        var writer = new Writer(json[i], json[i]['id']+'.json', writerConfig);
        writer.writeJson();
      }
    } else {
      console.log(res);
    }
  }).catch((err) => {
    console.log(err);
  });
});
