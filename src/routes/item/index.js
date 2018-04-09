const fs = require('fs')
const tools = require('../../modules/tools')
const User = require('../../modules/user')
const queries = require('../../modules/queries')

exports.index = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  templateValues.msg = 'Hello world!'

  const config = tools.getConfig()

  //  Check to see if we have an id, if not then redirect back to root
  //  TODO: in the future we'll redirect to /objects
  if (!('params' in request) || !('id' in request.params)) {
    return response.redirect('/')
  }

  //  Grab the id
  const {
    id
  } = request.params
  const itemName = request.params.item
  let itemTitle = 'Unknown'
  switch (itemName) {
    case 'objects':
      itemTitle = 'Object'
      break
    case 'authors':
      itemTitle = 'Author'
      break
    default:
      itemTitle = 'Unknown'
  }

  //  Setup all the directory stuff
  const rootDir = process.cwd()
  const dataDir = `${rootDir}/app/data/tms/${itemName}`
  const jsonFile = `${dataDir}/json/id_${id}.json`
  const xmlFile = `${dataDir}/xml/id_${id}.xml`

  //  Go grab the JSON file
  let itemJSON = null
  if (fs.existsSync(jsonFile)) {
    itemJSON = fs.readFileSync(jsonFile, 'utf-8')
  }

  //  Go grab the XML file
  let itemXML = null
  if (fs.existsSync(xmlFile)) {
    itemXML = fs.readFileSync(xmlFile, 'utf-8')
  }

  let showResults = true
  if (itemJSON === null && itemXML === null) {
    showResults = false
  }

  let GraphQLQuery = 'query{}'
  if (itemName === 'objects') {
    GraphQLQuery = `query{
      artwork(id: ${id}) {
        id
        areacategories {
          rank
          type
          areacat {
            lang
            text
          }
        }
        areacategory_concat {
          value
        }
        makers {
          maker
          rank
          nationality
          name
          makernameid
          birthyear_yearformed
          deathyear
          roles {
            lang
            text
          }
        }
        makers_concat {
          id
        }
        copyrightcreditlines {
          lang
          text
        }
        creditlines {
          lang
          text
        }
        datebegin
        dateend
        dimensions {
          lang
          text
        }
        exhibitions {
          begindate
          enddate
          ExhibitionID
          Section
          title {
            lang
            text
          }
          venues {
            begindate
            enddate
            name {
              lang
              text
            }
          }
        }
        exhibitions_concat {
          ObjectID
          exhinfo
        }
         exhlabels {
           text
           lang
           purpose
         }
        medias {
          rank
          PublicAccess
          primarydisplay
          filename
          alttext
          imagecreditlines
          imagecaption
          exists
          remote
          width
          height
          baseUrl
          squareUrl
          smallUrl
          mediumUrl
          largeUrl
        }
        mediums {
          lang
          text
        }
        MPlusRights {
          ObjRightsID
          ObjectID
          ObjRightsTypeID
          ObjRightsType
          ContractNumber
          CopyrightRegNumber
          Copyright
          Restrictions
          AgreementSentISO
          AgreementSignedISO
          ExpirationISODate
          CreditLineRepro
        }
        MPlusRightsFlexFields {
          RightGroup
          Value
          Date
          Remarks
        }
        MPlusRightsFlexFieldsConcat {
          Rights
        }
        objectnumber
        objectstatus {
          lang
          text
        }
        PublicAccess
        summaries
        titles {
          lang
          text
        }
        dated
        
      }
    }`
  }
  if (itemName === 'authors') {
    GraphQLQuery = `{
      author(id: ${id}) {
        id
      }
    }`
  }

  let filter = null
  if ('graphql' in config && 'host' in config.graphql) {
    showQL = true
    filter = `(id: ${id})`
  }

  templateValues.user = user
  templateValues.id = id
  templateValues.queries = queries
  templateValues.showResults = showResults
  templateValues.itemName = itemName
  templateValues.itemTitle = itemTitle
  templateValues.filter = filter
  templateValues.itemJSON = itemJSON
  templateValues.itemXML = itemXML
  templateValues.showQL = showQL
  templateValues.pingData = tools.getPingData()
  templateValues.config = config
  return response.render('item/index', templateValues)
}