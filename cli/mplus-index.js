#!/usr/bin/env node

const config = require('config')
const chalk = require('chalk')
const program = require('commander')
const fs = require('fs')
const path = require("path")
const elasticsearch = require('elasticsearch')
const async = require("async")

const writerConfig = config.get('data')
const esConfig = config.get('elasticsearch')

program
  .option('-c, --create <name>', 'Create a new index')
  .option('-d, --drop <name>', 'Delete an index')
  .option('-r, --reindex <name>', 'Reindex all objects to the specified index')
  .parse(process.argv)

const esHost = esConfig.host+':'+esConfig.port
const client = new elasticsearch.Client({
    host: esHost
})

if (program.create) {
  client.indices.create({
    index: program.create

  }).then((body) => {
    console.log(chalk.bold.green(JSON.stringify(body)))

  }, (error) => {
    console.trace(error.message)
  })
}

if (program.drop) {
  client.indices.delete({
    index: program.drop

  }).then((body) => {
    console.log(chalk.bold.red(JSON.stringify(body)))

  }, (error) => {
    console.trace(error.message)
  })
}

if (program.reindex) {
  client.indices.delete({
    index: program.reindex

  }).then((body) => {
    console.log(chalk.bold.red(JSON.stringify(body)))

    client.indices.create({
      index: program.reindex

    }).then((body) => {
      console.log(chalk.bold.green(JSON.stringify(body)))

      fs.readdir(writerConfig.json, function (err, files) {
        if (err) throw err

        files.map((file) => {
          return path.join(writerConfig.json, file)

        }).filter((file) => {
          return fs.statSync(file).isFile()

        }).forEach((file) => {
          console.log("%s (%s)", file, path.extname(file))

          fs.readFile(file, 'utf-8', (err, data) => {
			    if (err) throw err

			    console.log("Read file %s", file)

			    client.index({
			        index: esConfig.index,
			        type: 'artwork',
			        id: path.basename(file, '.json'),
			        body: data
			    }).then((body) => {
			        console.log(chalk.bold.green(JSON.stringify(body)))

			    }, (error) => {
			        console.trace(error.message)
			    })
          })
        })
      })
    }, (error) => {
      console.trace(error.message)
    })
  }, (error) => {
    console.trace(error.message)
  })
}
