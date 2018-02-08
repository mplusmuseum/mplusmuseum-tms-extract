const fs = require('fs');
const config = require('../../../config.json');

exports.index = async (request, response) => {
  const templateValues = {};
  templateValues.msg = 'Hello world!';

  //  Check to see if we have an id, if not then redirect back to root
  //  TODO: in the future we'll redirect to /objects
  if (!('params' in request) || !('id' in request.params)) {
    return response.redirect('/');
  }

  //  Grab the id
  const { id } = request.params;

  //  Setup all the directory stuff
  const rootDir = process.cwd();
  const dataDir = `${rootDir}/app/data/tms/objects`;
  const jsonFile = `${dataDir}/json/id_${id}.json`;
  const xmlFile = `${dataDir}/xml/id_${id}.xml`;

  //  Go grab the JSON file
  let objectJSON = null;
  console.log(jsonFile);
  if (fs.existsSync(jsonFile)) {
    objectJSON = fs.readFileSync(jsonFile, 'utf-8');
  }

  //  Go grab the XML file
  let objectXML = null;
  if (fs.existsSync(xmlFile)) {
    objectXML = fs.readFileSync(xmlFile, 'utf-8');
  }

  let showResults = true;
  if (objectJSON === null && objectXML === null) {
    showResults = false;
  }

  const GraphQLQuery = `{
  artwork(id: ${id}) {
    id
    area {
      id
    }
    areacategories {
      rank
      type
    }
    category {
      id
    }
    creditLines {
      lang
      text
    }
    dated
    dateBegin
    dateEnd
    dimensions {
      lang
      text
    }
    makers {
      id
    }
    medias {
      rank
      primarydisplay
      filename
    }
    medium {
      id
    }
    objectNumber
    objectStatus {
      lang
      text
    }
    titles {
      lang
      text
    }
  }
}`;
  const encodedQuery = encodeURIComponent(GraphQLQuery);
  const encodedQL = `${config.graphql.host}/graphql?query=${encodedQuery}`;
  const encodedAPI = `${
    config.graphql.host
  }/api-explorer?query=${encodedQuery}`;
  templateValues.id = id;
  templateValues.showResults = showResults;
  templateValues.objectJSON = objectJSON;
  templateValues.objectXML = objectXML;
  templateValues.GraphQLQuery = GraphQLQuery;
  templateValues.encodedQL = encodedQL;
  templateValues.encodedAPI = encodedAPI;
  return response.render('object/index', templateValues);
};
