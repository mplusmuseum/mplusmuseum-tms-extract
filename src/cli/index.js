const program = require('commander')
const chalk = require('chalk')

program
  .name(process.env.npm_package_name)
  .version(process.env.npm_package_version)
  .description('Tools for working with tms-xml and elastic search')
  .option('-i, --input <path>', 'file to work with')
  .option('-o, --output <path>', 'file to write to instead of stdout')

program
  .command('convert')
  .description('Convert TMS-XML to json')
  .action(() => {
    require('./tmsxml2json.js').tmsxml2json(
      arguments
    )
  })

program
  .command('ingest')
  .description('Ingest json to elasticsearch')
  .action(() => {
    require('./json2elasticsearch.js').json2elasticsearch(
      arguments
    )
  })

if (!process.argv.slice(2).length) {
  program.outputHelp(chalk.red)
}

program.parse(process.argv)
