const Queries = require('../../classes/queries/exploreomatic.js')
const GraphQL = require('../../classes/graphQL')
const utils = require('../../modules/utils')
const elasticsearch = require('elasticsearch')
const Config = require('../../classes/config')

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
        background: `hsl(${hsl[0] * 360}, ${hsl[1] * 66}%, ${((hsl[2] * 66) + 34)}%)`,
        foreground: 'black',
        hsl: {
          h: parseInt(hsl[0] * 360, 10),
          s: parseInt(hsl[1] * 100, 10),
          l: parseInt(hsl[2] * 100, 10)
        }
      }
      if (hsl[2] < 0.3) object.predominant.foreground = 'white'
    }

    //  Also add nice percents to the predominant colours
    if (object.color && object.color.predominant && object.color.predominant.length > 0) {
      let total = 0.0
      object.color.predominant.forEach((pred) => {
        total += pred.value
      })
      object.color.predominant = object.color.predominant.map((pred) => {
        pred = {
          color: pred.color,
          percent: pred.value / total * 100,
          nicePercent: pred.value
        }
        return pred
      })
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

const stubObjects = (objects) => {
  return objects.map((object) => {
    //  Turn things into title and stubs
    if (object.medium) {
      object.medium = {
        title: object.medium,
        stub: object.medium.replace(/\//g, '_')
      }
    }
    if (object.objectStatus) {
      object.objectStatus = {
        title: object.objectStatus,
        stub: object.objectStatus.replace(/\//g, '_')
      }
    }
    if (object.objectName) {
      object.objectName = {
        title: object.objectName,
        stub: object.objectName.replace(/\//g, '_')
      }
    }
    if (object.classification) {
      if (object.classification.area) {
        object.classification.area = {
          title: object.classification.area,
          stub: object.classification.area.replace(/\//g, '_')
        }
      }
      if (object.classification.category) {
        object.classification.category = {
          title: object.classification.category,
          stub: object.classification.category.replace(/\//g, '_')
        }
      }
      if (object.classification.archivalLevel) {
        object.classification.archivalLevel = {
          title: object.classification.archivalLevel,
          stub: object.classification.archivalLevel.replace(/\//g, '_')
        }
      }
    }
    return object
  })
}

exports.index = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  Grab the query used to ask for an object
  const queries = new Queries()
  const query = queries.get('objects', `(isRecommended: true, lang:"${req.templateValues.dbLang}")`)
  //  Now we need to actually run the query
  const graphQL = new GraphQL()
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.objects) {
    req.templateValues.objects = stubObjects(contrastColors(results.data.objects))
  }
  req.templateValues.mode = 'recommended'
  return res.render('explore-o-matic/index', req.templateValues)
}

exports.constituents = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"alphaSortName", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const makertypesQuery = queries.get('makertypes', `(lang:"${req.templateValues.dbLang}")`)
  const makertypesPayload = {
    query: makertypesQuery
  }
  const makertypesResults = await graphQL.fetch(makertypesPayload)
  if (makertypesResults.data && makertypesResults.data.makertypes) {
    req.templateValues.makertypes = makertypesResults.data.makertypes.map((type) => {
      //  TODO: make this replace *all* not just the first one
      type.stub = type.title.replace(/\//g, '_')

      //  TODO: Don't do checking for language this way
      if (req.templateValues.dbLang === 'en') {
        if (type.title.match(/^([a-zA-Z0-9@*#])/) !== null) return type
        return false
      }
      if (req.templateValues.dbLang === 'zh-hant') {
        if (type.title.match(/^([a-zA-Z0-9@*#])/) === null) return type
        return false
      }
    }).filter(Boolean)
  }

  if ('makerStub' in req.params) {
    const makerType = req.params.makerStub.replace(/_/g, '/')
    searchFilter = `(per_page: 5000, sort_field:"alphaSortName", role:"${makerType}", lang:"${req.templateValues.dbLang}")`
    req.templateValues.thisMakerType = req.params.makerStub
  }

  //  Grab the query used to ask for an object
  const query = queries.get('constituentList', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

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
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('areas', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

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
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('categories', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

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

exports.archivalLevels = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('archivalLevels', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.archivalLevels) {
    req.templateValues.archivalLevels = results.data.archivalLevels.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'archivalLevels'
  return res.render('explore-o-matic/archivalLevels', req.templateValues)
}

exports.objectNames = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('objectNames', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.names) {
    req.templateValues.objectNames = results.data.names.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'objectNames'
  return res.render('explore-o-matic/objectNames', req.templateValues)
}

exports.objectStatuses = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('objectStatuses', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.statuses) {
    req.templateValues.objectStatuses = results.data.statuses.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'objectStatuses'
  return res.render('explore-o-matic/objectStatuses', req.templateValues)
}

exports.collectionTypes = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('collectionTypes', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.collectionTypes) {
    req.templateValues.collectionTypes = results.data.collectionTypes.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'collectionTypes'
  return res.render('explore-o-matic/collectionTypes', req.templateValues)
}

exports.collectionCodes = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('collectionCodes', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.collectionCodes) {
    req.templateValues.collectionCodes = results.data.collectionCodes.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'collectionCodes'
  return res.render('explore-o-matic/collectionCodes', req.templateValues)
}

exports.exhibitions = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('exhibitions', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

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
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title", lang:"${req.templateValues.dbLang}")`

  //  Grab all the different maker types
  const query = queries.get('mediums', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

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
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = ''
  let thisQuery = 'objects'
  const perPage = 30
  let page = 0
  if (req.params.page) page = parseInt(req.params.page, 10) - 1
  if (isNaN(page)) page = 0
  if (page < 0) page = 0

  const newFilter = req.params.filter.replace(/_/g, '/')

  if (req.params.thing === 'category') {
    req.templateValues.mode = 'categories'
    req.templateValues.title = `Category: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this category`
    searchFilter = `(per_page: ${perPage}, page: ${page}, category: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'medium') {
    req.templateValues.mode = 'mediums'
    req.templateValues.title = `Medium: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this medium`
    searchFilter = `(per_page: ${perPage}, page: ${page}, medium: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'area') {
    req.templateValues.mode = 'areas'
    req.templateValues.title = `Area: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this area`
    searchFilter = `(per_page: ${perPage}, page: ${page}, area: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'archivalLevel') {
    req.templateValues.mode = 'archivalLevels'
    req.templateValues.title = `Archival Level: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this archival level`
    searchFilter = `(per_page: ${perPage}, page: ${page}, archivalLevel: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'objectName') {
    req.templateValues.mode = 'objectNames'
    req.templateValues.title = `Object Name: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this object name`
    searchFilter = `(per_page: ${perPage}, page: ${page}, objectName: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'objectStatus') {
    req.templateValues.mode = 'objectStatuses'
    req.templateValues.title = `Object Status: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this object status`
    searchFilter = `(per_page: ${perPage}, page: ${page}, objectStatus: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'collectionType') {
    req.templateValues.mode = 'collectionTypes'
    req.templateValues.title = `Collection Type: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this collection type`
    searchFilter = `(per_page: ${perPage}, page: ${page}, collectionType: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'collectionCode') {
    req.templateValues.mode = 'collectionCodes'
    req.templateValues.title = `Collection Code: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this collection code`
    searchFilter = `(per_page: ${perPage}, page: ${page}, collectionCode: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'constituent') {
    req.templateValues.mode = 'constituent'
    req.templateValues.title = `Constituent ID: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this constituent`
    thisQuery = 'constituent'
    searchFilter = `(per_page: ${perPage}, page: ${page}, id: ${newFilter}, lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'exhibition') {
    req.templateValues.mode = 'exhibition'
    req.templateValues.title = `Exhibition ID: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this exhibition`
    thisQuery = 'exhibition'
    searchFilter = `(per_page: ${perPage}, page: ${page}, id: ${newFilter}, lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.filter === 'popular') {
    req.templateValues.mode = 'popular'
    req.templateValues.title = `Popular Objects`
    req.templateValues.subTitle = `A collection of objects sorted by popular`
    searchFilter = `(per_page: ${perPage}, page: ${page}, sort_field: "popularCount", sort: "desc", lang:"${req.templateValues.dbLang}")`
  }

  //  Grab all the different maker types
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query
  const results = await graphQL.fetch(payload)
  let pagination = null

  if (results.data && results.data[thisQuery]) {
    if (thisQuery === 'constituent' || thisQuery === 'exhibition') {
      if (thisQuery === 'constituent') {
        const constituent = results.data[thisQuery]
        const objects = stubObjects(contrastColors(constituent.objects))
        req.templateValues.objects = objects
        delete constituent.objects

        //  Convert the roles into an array we can deal with stubs
        constituent.roles = constituent.roles.map((role) => {
          return {
            title: role,
            stub: role.replace(/\//g, '_')
          }
        })
        req.templateValues.constituent = constituent
        //  Grab the pagination if we can
        if (objects.length > 0 && objects[0]._sys && objects[0]._sys.pagination) {
          pagination = objects[0]._sys.pagination
        }
      }
      if (thisQuery === 'exhibition') {
        const exhibition = results.data[thisQuery]
        const objects = stubObjects(contrastColors(exhibition.objects))
        req.templateValues.objects = objects
        delete exhibition.objects
        req.templateValues.exhibition = exhibition
        //  Grab the pagination if we can
        if (objects.length > 0 && objects[0]._sys && objects[0]._sys.pagination) {
          pagination = objects[0]._sys.pagination
        }
      }

      //  Stub up the objects
    } else {
      const objects = contrastColors(results.data[thisQuery])

      req.templateValues.objects = stubObjects(objects)

      //  Grab the pagination if we can
      if (objects.length > 0 && objects[0]._sys && objects[0]._sys.pagination) {
        pagination = objects[0]._sys.pagination
      }
    }
  }

  //  Now a long way of doing pagination. If this was used in more places
  //  I'd probably turn it into a helper and an include on the templates
  //  But for the moment, here's a long form way of making this as easy
  //  as possible for the template to work out what to do.
  if (pagination) {
    const range = 2

    pagination.showStartEllipses = false
    pagination.showEndEllipses = false
    pagination.showEllipses = false
    pagination.showPrevious = true
    pagination.showNext = true

    pagination.page += 1
    pagination.maxPage += 1

    if (pagination.page - range - 1 <= 1) {
      pagination.startPage = 1
    } else {
      pagination.startPage = pagination.page - range
      pagination.showStartEllipses = true
      pagination.showEllipses = true
    }

    if (pagination.page + range + 1 >= pagination.maxPage) {
      pagination.endPage = pagination.maxPage
    } else {
      pagination.endPage = pagination.page + range
      pagination.showEndEllipses = true
      pagination.showEllipses = true
    }

    if (pagination.page <= 1) pagination.showPrevious = false
    if (pagination.page >= pagination.maxPage) pagination.showNext = false
    pagination.pageLoop = Array.from(Array(pagination.endPage - pagination.startPage + 1), (_, x) => x + pagination.startPage)
    pagination.previousPage = pagination.page - 1
    pagination.nextPage = pagination.page + 1
  } else {
    pagination = {}
    pagination.showStartEllipses = false
    pagination.showEndEllipses = false
    pagination.showEllipses = false
    pagination.showPrevious = false
    pagination.showNext = false
    pagination.pageLoop = [1]
  }

  pagination.target = `/explore-o-matic/${req.params.thing}`
  if (req.params.filter) pagination.target += `/${req.params.filter}`
  pagination.target += `/page/`
  req.templateValues.pagination = pagination
  return res.render('explore-o-matic/objects', req.templateValues)
}

exports.getColor = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  This is a bit of an odd way to load in the script, as really
  //  markup should be in the template. BUT, in this case we're
  //  going to generate the script here
  req.templateValues.pickedScript = `<script>
  document.addEventListener("DOMContentLoaded", function (event) {
    var thisPalette = new palette();
    thisPalette.draw();
  });
  </script>`

  //  If we have been passed some HSL values then we need to grab
  //  them so we can do the object search *AND* pass them over
  //  so we can put them on the picker
  if (req.params.hsl) {
    const hsl = req.params.hsl.split(',')
    const h = parseInt(hsl[0], 10)
    const l = parseInt(hsl[2], 10) * 2

    req.templateValues.pickedScript = `<script>
    document.addEventListener("DOMContentLoaded", function (event) {
      var thisPalette = new palette();
      thisPalette.draw({x: ${h}, y: ${l}});
    });
    </script>`

    const queries = new Queries()
    const graphQL = new GraphQL()

    //  This is the initial search query we are going to use to grab all the constituents
    const perPage = 60
    const page = 0
    const searchFilter = `(per_page: ${perPage}, page: ${page}, hue: ${h}, luminosity: ${l / 2}, lang:"${req.templateValues.dbLang}")`
    const thisQuery = 'objects'
    const query = queries.get(thisQuery, searchFilter)
    const payload = {
      query
    }
    req.templateValues.query = query
    const results = await graphQL.fetch(payload)
    if (results.data && results.data[thisQuery]) {
      req.templateValues.objects = contrastColors(results.data[thisQuery])
    }
  }

  req.templateValues.mode = 'color'
  return res.render('explore-o-matic/colour', req.templateValues)
}

exports.getObject = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = 'objects_mplus'
  const type = 'object'

  //  This is the initial search query we are going to use to grab all the constituents
  let thisQuery = 'object'
  const newFilter = parseInt(req.params.filter, 10)
  let searchFilter = `(id: ${newFilter}, lang:"${req.templateValues.dbLang}")`

  //  If we have an action the we want to set something on this object, we need
  //  to do that here
  if (req.body.action) {
    //  If the action is to toggle the recommended value then we need to do that
    if (req.body.action === 'toggleRecommended') {
      let isRecommended = false
      if (req.body.recommended && req.body.recommended === 'true') isRecommended = true
      //  Check to see if there's any blurb, if so we need to set there here
      const blurb = {}
      if (req.body.blurb) {
        blurb[req.templateValues.dbLang] = req.body.blurb
      }
      //  Update the database
      await esclient.update({
        index,
        type,
        id: newFilter,
        body: {
          doc: {
            id: newFilter,
            isRecommended,
            recommendedBlurb: blurb
          },
          doc_as_upsert: true
        }
      })
      return setTimeout(() => {
        res.redirect(`/explore-o-matic/object/${newFilter}#admintools`)
      }, 1000)
    }
  }

  //  Grab all the different maker types
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)

  if (results.data && results.data[thisQuery]) {
    const object = stubObjects(contrastColors([results.data[thisQuery]]))[0]

    //  See if we have been passed an bump action, if so we need to adjust the
    //  popularCount
    if (req.body.bumpPopular) {
      let newPopularCount = parseInt(req.body.bumpPopular, 10)

      //  Update the database
      await esclient.update({
        index,
        type,
        id: object.id,
        body: {
          script: `ctx._source.popularCount += ${newPopularCount}`
        }
      })
      return setTimeout(() => {
        res.redirect(`/explore-o-matic/object/${object.id}#admintools`)
      }, 3000)
    }
    req.templateValues.object = object

    //  As we have an object we need to go through and grab all the shortcodes
    const shortCodes = []

    //  1st the constituents
    if (object.constituents) {
      object.constituents.forEach((constituent) => {
        shortCodes.push(`[[constituent|${constituent.name}|${constituent.id}]]`)
      })
    }
    //  Now the area, category and archivalLevel
    if (object.classification) {
      if (object.classification.area) {
        shortCodes.push(`[[area|${object.classification.area.title}|${object.classification.area.stub}]]`)
      }
      if (object.classification.category) {
        shortCodes.push(`[[category|${object.classification.category.title}|${object.classification.category.stub}]]`)
      }
      if (object.classification.archivalLevel) {
        shortCodes.push(`[[archivalLevel|${object.classification.archivalLevel.title}|${object.classification.archivalLevel.stub}]]`)
      }
    }
    //  Medium
    if (object.medium) {
      shortCodes.push(`[[medium|${object.medium.title}|${object.medium.stub}]]`)
    }
    //  objectName
    if (object.objectName) {
      shortCodes.push(`[[objectName|${object.objectName.title}|${object.objectName.stub}]]`)
    }
    //  objectStatus
    if (object.objectStatus) {
      shortCodes.push(`[[objectStatus|${object.objectStatus.title}|${object.objectStatus.stub}]]`)
    }
    //  collectionType
    if (object.collectionType) {
      shortCodes.push(`[[collectionType|${object.collectionType.title}|${object.collectionType.stub}]]`)
    }
    //  collectionCode
    if (object.collectionCode) {
      shortCodes.push(`[[collectionCode|${object.collectionCode.title}|${object.collectionCode.stub}]]`)
    }
    req.templateValues.shortCodes = shortCodes
  }

  return res.render('explore-o-matic/object', req.templateValues)
}

exports.factpedia = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  if (req.body.action) {
    //  Get all the elastic search stuff
    const config = new Config()
    const elasticsearchConfig = config.get('elasticsearch')
    if (elasticsearchConfig === null) {
      req.templateValues.mode = 'factpedia'
      return res.render('explore-o-matic/factpedia', req.templateValues)
    }
    const esclient = new elasticsearch.Client(elasticsearchConfig)

    if (req.body.action === 'addFactoid') {
      //  Build a new record to enter
      //  Create the index if we need to
      const index = `factoids_mplus`
      const exists = await esclient.indices.exists({
        index
      })
      if (exists === false) {
        await esclient.indices.create({
          index
        })
      }

      await esclient.index({
        index,
        type: 'factoid',
        body: {
          fact: {
            en: req.body.factoidEN,
            'zh-hant': req.body.factoidTC
          }
        }
      })
      return setTimeout(() => {
        res.redirect('/explore-o-matic/factpedia')
      }, 2000)
    }

    if (req.body.action === 'updateFactoids') {
      const bulkThisArray = []
      Object.entries(req.body).forEach((thing) => {
        const key = thing[0]
        const value = thing[1]
        const keySplit = key.split('_')
        if (keySplit.length === 2) {
          if (keySplit[1] === 'factoidEN') {
            bulkThisArray.push({
              update: {
                _id: keySplit[0]
              }
            })
            bulkThisArray.push({
              doc: {
                fact: {
                  en: value
                }
              }
            })
          }
          if (keySplit[1] === 'factoidTC') {
            bulkThisArray.push({
              update: {
                _id: keySplit[0]
              }
            })
            bulkThisArray.push({
              doc: {
                fact: {
                  'zh-hant': value
                }
              }
            })
          }
        }
      })

      if (bulkThisArray.length > 0) {
        await esclient.bulk({
          index: `factoids_mplus`,
          type: 'factoid',
          body: bulkThisArray
        })
        // Note that we want to rebuld the constituents
        return setTimeout(() => {
          res.redirect('/explore-o-matic/factpedia')
        }, 2000)
      }
    }
  }

  //  Go and get the factoids
  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000)`

  //  Grab all the different maker types
  const query = queries.get('factoids', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.factoids) req.templateValues.factoids = results.data.factoids

  req.templateValues.mode = 'factpedia'
  return res.render('explore-o-matic/factpedia', req.templateValues)
}
