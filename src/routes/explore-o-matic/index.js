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
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  if ('makerStub' in req.params) {
    const makerType = req.params.makerStub.replace(/_/g, '/')
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

exports.areas = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('areas', searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data.areas) {
    req.templateValues.areas = results.data.areas.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'areas'
  return res.render('explore-o-matic/areas', req.templateValues)
}

exports.categories = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('categories', searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data.categories) {
    req.templateValues.categories = results.data.categories.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'categories'
  return res.render('explore-o-matic/categories', req.templateValues)
}

exports.exhibitions = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('exhibitions', searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data.exhibitions) {
    req.templateValues.exhibitions = results.data.exhibitions.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'exhibitions'
  return res.render('explore-o-matic/exhibitions', req.templateValues)
}

exports.mediums = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('mediums', searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data.mediums) {
    req.templateValues.mediums = results.data.mediums.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'mediums'
  return res.render('explore-o-matic/mediums', req.templateValues)
}

exports.getObjectsByThing = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = ''
  let thisQuery = 'objects'
  const perPage = 60
  const page = 0

  const newFilter = req.params.filter.replace(/_/g, '/')

  if (req.params.thing === 'category') {
    req.templateValues.mode = 'categories'
    searchFilter = `(per_page: ${perPage}, page: ${page}, category: "${newFilter}")`
  }

  if (req.params.thing === 'medium') {
    req.templateValues.mode = 'mediums'
    searchFilter = `(per_page: ${perPage}, page: ${page}, medium: "${newFilter}")`
  }

  if (req.params.thing === 'area') {
    req.templateValues.mode = 'areas'
    searchFilter = `(per_page: ${perPage}, page: ${page}, area: "${newFilter}")`
  }

  if (req.params.thing === 'constituent') {
    req.templateValues.mode = 'constituent'
    thisQuery = 'constituent'
    searchFilter = `(per_page: ${perPage}, page: ${page}, id: ${newFilter})`
  }

  if (req.params.thing === 'exhibition') {
    req.templateValues.mode = 'exhibition'
    thisQuery = 'exhibition'
    searchFilter = `(per_page: ${perPage}, page: ${page}, id: ${newFilter})`
  }

  //  Grab all the different maker types
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)

  if (results.data && results.data[thisQuery]) {
    if (thisQuery === 'constituent' || thisQuery === 'exhibition') {
      if (thisQuery === 'constituent') {
        const constituent = results.data[thisQuery]
        req.templateValues.objects = contrastColors(constituent.objects)
        delete constituent.objects
        //  Convert the roles into an array we can deal with
        constituent.roles = constituent.roles.map((role) => {
          return {
            title: role,
            stub: role.replace(/\//g, '_')
          }
        })
        req.templateValues.constituent = constituent
      }
      if (thisQuery === 'exhibition') {
        const exhibition = results.data[thisQuery]
        req.templateValues.objects = contrastColors(exhibition.objects)
        req.templateValues.exhibition = exhibition
      }
    } else {
      req.templateValues.objects = contrastColors(results.data[thisQuery])
    }
  }

  return res.render('explore-o-matic/objects', req.templateValues)
}

exports.getObject = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let thisQuery = 'object'
  const newFilter = parseInt(req.params.filter, 10)
  let searchFilter = `(id: ${newFilter})`

  //  Grab all the different maker types
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  if (results.data && results.data[thisQuery]) {
    const object = contrastColors([results.data[thisQuery]])[0]
    console.log(object)
    req.templateValues.object = object
    /*
    if (thisQuery === 'constituent' || thisQuery === 'exhibition') {
      if (thisQuery === 'constituent') {
        const constituent = results.data[thisQuery]
        req.templateValues.objects = contrastColors(constituent.objects)
        delete constituent.objects
        //  Convert the roles into an array we can deal with
        constituent.roles = constituent.roles.map((role) => {
          return {
            title: role,
            stub: role.replace(/\//g, '_')
          }
        })
        req.templateValues.constituent = constituent
      }
      if (thisQuery === 'exhibition') {
        const exhibition = results.data[thisQuery]
        req.templateValues.objects = contrastColors(exhibition.objects)
        req.templateValues.exhibition = exhibition
      }
    } else {
      req.templateValues.objects = contrastColors(results.data[thisQuery])
    }
    */
  }

  return res.render('explore-o-matic/object', req.templateValues)
}
