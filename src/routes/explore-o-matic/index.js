const Queries = require('../../classes/queries/exploreomatic.js')
const GraphQL = require('../../classes/graphQL')
const utils = require('../../modules/utils')

const contrastColors = (objects) => {
  return objects.map((object) => {
    //  Add the colour information
    object.predominant = {
      background: 'white',
      foreground: 'black'
    }
    if (object.color && object.color.predominant && object.color.predominant.length > 0) {
      const hsl = utils.hexToHsl(object.color.predominant[0].color)
      object.predominant = {
        background: object.color.predominant[0].color,
        foreground: 'black',
        hsl: {
          h: hsl[0] * 360,
          s: hsl[1] * 100,
          l: hsl[2] * 100
        }
      }
      if (hsl[2] < 0.3) object.predominant.foreground = 'white'
    }

    //  Get the main image
    if (object.images) {
      object.images.forEach((image) => {
        if (image.primaryDisplay && image.status === 'ok') {
          object.mainImage = image
        }
      })
    }
    return object
  })
}

exports.index = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  //  Grab the query used to ask for an object
  const queries = new Queries()
  const query = queries.get('objectsRandom')
  //  Now we need to actually run the query
  const graphQL = new GraphQL()
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data.randomobjects) {
    req.templateValues.objects = contrastColors(results.data.randomobjects)
  }
  req.templateValues.mode = 'random'
  return res.render('explore-o-matic/index', req.templateValues)
}

exports.constituents = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"alphaSortName")`

  //  Grab all the different maker types
  const makertypesQuery = queries.get('makertypes')
  const makertypesPayload = {
    query: makertypesQuery
  }
  const makertypesResults = await graphQL.fetch(makertypesPayload)
  if (makertypesResults.data && makertypesResults.data.makertypes) {
    req.templateValues.makertypes = makertypesResults.data.makertypes.map((type) => {
      //  TODO: make this replace *all* not just the first one
      type.stub = type.title.replace(' ', '-').replace('/', '_')
      return type
    })
  }

  if ('makerStub' in req.params) {
    //  TODO: make this replace *all* not just the first one
    const makerType = req.params.makerStub.replace('_', '/').replace('-', ' ')
    searchFilter = `(per_page: 5000, sort_field:"alphaSortName", role:"${makerType}")`
    req.templateValues.thisMakerType = req.params.makerStub
  }

  //  Grab the query used to ask for an object
  const query = queries.get('constituentList', searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  const alphaSorted = {}
  if (results.data && results.data.constituents) {
    const matched = {}
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
    //  Now go through each letter
    alphabet.forEach((letter) => {
      //  Pop it into the sorted objects so we can add the constituents
      if (!(letter in alphaSorted)) alphaSorted[letter] = []
      results.data.constituents.forEach((constituent) => {
        //  Check to see if the first letter of the alphasort name matches the current letter
        if (constituent.alphaSortName) {
          if (constituent.alphaSortName[0].toLowerCase() === letter) {
            alphaSorted[letter].push(constituent)
            matched[constituent.id] = constituent
          }
        } else {
          //  If there isn't an alphasortname then just use the name
          if (constituent.name) {
            if (constituent.name[0].toLowerCase() === letter) {
              alphaSorted[letter].push(constituent)
              matched[constituent.id] = constituent
            }
          }
        }
      })
    })

    //  Now go through all the remaining constituents to match up any that
    //  didn't match the alpha sorts
    results.data.constituents.forEach((constituent) => {
      if (!(constituent.id in matched)) {
        if (!('!%*#' in alphaSorted)) alphaSorted['!%*#'] = []
        alphaSorted['!%*#'].push(constituent)
      }
    })
  }

  //  Build up a list of elements we want to delete
  const deleteKey = []
  Object.entries(alphaSorted).forEach((element) => {
    if (element[1].length === 0) deleteKey.push(element[0])
  })
  //  Now delete the elements
  deleteKey.forEach((key) => {
    delete alphaSorted[key]
  })

  req.templateValues.alphaSorted = alphaSorted
  req.templateValues.mode = 'constituents'
  return res.render('explore-o-matic/constituents', req.templateValues)
}
