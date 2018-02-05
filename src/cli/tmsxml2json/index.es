const colours = require('colors');
const fs = require('fs');

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta',
});

const rootDir = process.cwd();

/*
TODO: These settings should be either auto detected, in a config file
or requested via the admin page (config for the folder, admin page
for the files)
*/
const sourceDir = `${rootDir}/app/data/xml`;
const sourceFile = 'ExportForMPlus_Objects_UCS.xml';

/*
This is where we check to see if the directory that the source XML files
should be put in.
*/
console.log('Checking for XML directory'.info);
if (!fs.existsSync(sourceDir)) {
  console.log('There is no /app/data/xml folder.'.alert);
  console.log('Create the folder and add the XML files'.alert);
  process.exit(1);
}
console.log('We have the source directory'.info);

/*
Now we check to see if we have the XML file in there.
*/
console.log('Checking for XML file'.info);
if (!fs.existsSync(`${sourceDir}/${sourceFile}`)) {
  console.log(`Missing file: ${sourceFile}`.alert);
  process.exit(1);
}
console.log('We have the source XML file'.info);

/*
Here we read in the XML file and spit out individual converted JSON files
*/

console.log('Hello world'.help);
