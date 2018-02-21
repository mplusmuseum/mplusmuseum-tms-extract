const fs = require('fs');

/**
 * This reads the config from wherever it's kept and turns it into JSON
 * before passing it back.
 * We will probably move this into an external utils module when we need to
 * use it in more than one place.
 * We may also be fetching this from some other place over the network than
 * the local file system
 * @return {Boolean}        If we did a bulk upload or not
 */
const getConfig = () => {
  //  Read in the config file, if there is one
  const rootDir = process.cwd();
  const configFile = `${rootDir}/config.json`;
  let configJSON = {};
  if (fs.existsSync(configFile)) {
    const configTxt = fs.readFileSync(configFile, 'utf-8');
    configJSON = JSON.parse(configTxt);
  }
  return configJSON;
};

/**
 * This takes whatever config file is passed to it, cleans it up from the
 * temporary values we added into it and then saves it. We should proably
 * work around that but for the moment this is easier.
 * We will probably move this into an external utils module when we need to
 * use it in more than one place.
 * We may also be putting this onto some other place over the network than
 * the local file system
 * @param {Object} json     The config XML file
 */
const putConfig = (configJSON) => {
  const rootDir = process.cwd();
  const configFile = `${rootDir}/config.json`;
  const newJSON = configJSON;

  //  Clean up the things we want to delete
  if ('xml' in newJSON) {
    newJSON.xml = configJSON.xml.map((itemData) => {
      const newData = itemData;
      delete newData.missing;
      delete newData.exists;
      return newData;
    });
  }

  const configJSONPretty = JSON.stringify(newJSON, null, 4);
  fs.writeFileSync(configFile, configJSONPretty, 'utf-8');
};

exports.index = async (request, response) => {
  const templateValues = {};
  templateValues.msg = 'Hello world!';

  //  Read in the config file, if there is one
  const configJSON = getConfig();

  //  Go through the config checking that the xml files we are looking for
  //  actually exists.
  //  NOTE: The missing/exists may seem redundant, but we're just making it
  //  easier for the front end to toggle displays
  const rootDir = process.cwd();
  if ('xml' in configJSON) {
    configJSON.xml = configJSON.xml.map((itemData) => {
      const newItem = itemData;
      const xmlFile = `${rootDir}/app/data/xml/${itemData.file}`;
      if (fs.existsSync(xmlFile)) {
        newItem.missing = false;
        newItem.exists = true;
      } else {
        newItem.missing = true;
        newItem.exists = false;
      }
      return newItem;
    });
  }

  //  See if we've been POSTED any data, which could be searching for items,
  //  updating the config and so on... if we have something then work out
  //  what to do with it.
  if ('body' in request) {
    //  If we've been passed an ID then we are probably looking up an item
    //  TODO: we also need to know the 'type'/'index' of the item
    if ('id' in request.body) {
      return response.redirect(`/object/${request.body.id}`);
    }

    //  We have been passed an action, which could be all sorts of things, in
    //  here we'll figure out which action we have been passed and then act
    //  on it.
    if ('action' in request.body) {
      let saveConfig = false;

      //  If we are updating the hosts info, then we do that here
      if (request.body.action === 'updatehosts') {
        //  Do the elastic search part
        if ('elasticsearch' in request.body) {
          if (!('elasticsearch' in configJSON)) {
            configJSON.elasticsearch = {
              host: '',
            };
          }
          if (request.body.elasticsearch !== configJSON.elasticsearch.host) {
            saveConfig = true;
            configJSON.elasticsearch.host = request.body.elasticsearch;
          }
          if (configJSON.elasticsearch.host === '') {
            saveConfig = true;
            delete configJSON.elasticsearch;
          }
        }
        //  Do the graphQL part
        if ('graphql' in request.body) {
          if (!('graphql' in configJSON)) {
            configJSON.graphql = {
              host: '',
            };
          }
          if (request.body.graphql !== configJSON.graphql.host) {
            saveConfig = true;
            configJSON.graphql.host = request.body.graphql;
          }
          if (configJSON.graphql.host === '') {
            saveConfig = true;
            delete configJSON.graphql;
          }
        }
      }

      //  If we have been passed the action to delete an xml entry then we
      //  do that here
      if (request.body.action.split(':')[0] === 'delete') {
        const xmlFile = request.body.action.split(':')[1];
        configJSON.xml = configJSON.xml.filter((itemData) => {
          if (itemData.file === xmlFile) {
            return false;
          }
          return true;
        });
        saveConfig = true;
      }

      //  If we have been passed the action to add an xml entry then we
      //  do that here
      if (request.body.action.split(':')[0] === 'add') {
        //  Grab all the data.
        //  TODO: Note we are making assuptions that these fields exist,
        //  because we control the HTML and it's auth protected, so why would
        //  someone be trying to mess around with fudging input data. Regardless
        //  we should put some more error checking in.
        const xmlFile = request.body.action.split(':')[1];
        const index = request.body[`index:${xmlFile}`];
        const type = request.body[`type:${xmlFile}`];
        //  If the index or type is empty don't do anything.
        //  TODO: add error message
        if (index === '' || type === '') {
          return response.redirect('/');
        }
        console.log(request.body);
        console.log('xmlFile: ', xmlFile);
        console.log('index: ', index);
        console.log('type: ', type);
        if (!('xml' in configJSON)) {
          configJSON.xml = [];
        }
        //  TODO: check the entry doesn't already exist so we don't enter
        //  duplate values
        configJSON.xml.push({
          file: xmlFile,
          index,
          type,
        });
        saveConfig = true;
      }

      if (saveConfig === true) {
        putConfig(configJSON);
        return response.redirect('/');
      }
    }
  }

  //  Now we want to look in the app/data/xml folder to see if there are any
  //  files in there that aren't in the config file, if so it means we can
  //  offer them up to be added
  let existingFiles = [];
  if ('xml' in configJSON) {
    existingFiles = configJSON.xml.map(itemData => itemData.file);
  }
  let addableFiles = null;
  let appdataxmlExists = false;
  const dataDir = `${rootDir}/app/data/xml`;
  if (fs.existsSync(dataDir)) {
    appdataxmlExists = true;
    const files = fs
      .readdirSync(dataDir)
      .filter(file => file.split('.')[1] === 'xml')
      .filter(file => !existingFiles.includes(file));
    addableFiles = files;
  }

  templateValues.appdataxmlExists = appdataxmlExists;
  templateValues.addableFiles = addableFiles;
  templateValues.config = configJSON;
  return response.render('main/index', templateValues);
};
