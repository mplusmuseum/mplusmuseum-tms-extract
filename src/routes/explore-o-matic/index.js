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
    if (object.medium && !object.medium.stub) {
      object.medium = {
        title: object.medium,
        stub: object.medium.replace(/\//g, '_')
      }
    }
    if (object.objectStatus && !object.objectStatus.stub) {
      object.objectStatus = {
        title: object.objectStatus,
        stub: object.objectStatus.replace(/\//g, '_')
      }
    }
    if (object.objectName && !object.objectName.stub) {
      object.objectName = {
        title: object.objectName,
        stub: object.objectName.replace(/\//g, '_')
      }
    }
    if (object.classification) {
      if (object.classification.area && !object.classification.area.stub) {
        object.classification.area = {
          title: object.classification.area,
          stub: object.classification.area.replace(/\//g, '_')
        }
      }
      if (object.classification.category && !object.classification.category.stub) {
        object.classification.category = {
          title: object.classification.category,
          stub: object.classification.category.replace(/\//g, '_')
        }
      }
      if (object.classification.archivalLevel && !object.classification.archivalLevel.stub) {
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
  const pageStart = new Date().getTime()
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  See if we've been passed a query
  if (req.body && req.body.query) {
    return res.redirect(`/explore-o-matic/search/${req.body.query}`)
  }

  //  Grab the query used to ask for an object
  let perPage = 30
  let page = 0
  if (req.params.page) page = parseInt(req.params.page, 10) - 1
  if (isNaN(page)) page = 0
  if (page < 0) page = 0

  const queries = new Queries()
  let query = queries.get('objects', `(per_page: ${perPage}, page: ${page}, isRecommended: true, lang:"${req.templateValues.dbLang}")`)
  if (req.params.query) {
    req.templateValues.searchQuery = req.params.query
    query = queries.get('objects', `(keyword: "${req.params.query}", per_page: ${perPage}, page: ${page}, lang:"${req.templateValues.dbLang}")`)
  }
  //  Now we need to actually run the query
  const graphQL = new GraphQL()
  const payload = {
    query
  }
  req.templateValues.query = query

  const preObjectsTime = new Date().getTime()
  const results = await graphQL.fetch(payload)
  const getObjectsQuery = new Date().getTime() - preObjectsTime
  if (results.data && results.data.objects) {
    const objects = stubObjects(contrastColors(results.data.objects))
    //  Grab the pagination if we can
    if (objects.length > 0 && objects[0]._sys && objects[0]._sys.pagination) {
      const pagination = objects[0]._sys.pagination
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
      pagination.target = `/explore-o-matic/page/`
      if (req.templateValues.searchQuery) {
        pagination.target = `/explore-o-matic/search/${req.templateValues.searchQuery}/page/`
      }
      req.templateValues.pagination = pagination
    }
    req.templateValues.objects = objects
  }

  req.templateValues.mode = 'recommended'

  const pageEnd = new Date().getTime()

  req.templateValues.timing = {
    getObjectsQuery,
    totalQueryTime: (getObjectsQuery),
    totalNotQueryTime: (pageEnd - pageStart) - (getObjectsQuery),
    pageGenerationTime: pageEnd - pageStart
  }

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

exports.collectionNames = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('collectionNames', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.collectionNames) {
    req.templateValues.collectionNames = results.data.collectionNames.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'collectionNames'
  return res.render('explore-o-matic/collectionNames', req.templateValues)
}
exports.departments = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('departments', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.departments) {
    req.templateValues.departments = results.data.departments.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'departments'
  return res.render('explore-o-matic/departments', req.templateValues)
}
exports.styles = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, sort_field:"title")`

  //  Grab all the different maker types
  const query = queries.get('styles', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.styles) {
    req.templateValues.styles = results.data.styles.map((type) => {
      type.stub = type.title.replace(/\//g, '_')
      return type
    })
  }

  req.templateValues.mode = 'styles'
  return res.render('explore-o-matic/styles', req.templateValues)
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
  const pageStart = new Date().getTime()

  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = ''
  let thisQuery = 'objects'
  let perPage = 30
  let page = 0
  if (req.params.page) page = parseInt(req.params.page, 10) - 1
  if (isNaN(page)) page = 0
  if (page < 0) page = 0

  //  Grab the filter if there is one
  let newFilter = null
  if (req.params && req.params.filter) {
    newFilter = req.params.filter.replace(/_/g, '/')
  }

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

  if (req.params.thing === 'collectionName') {
    req.templateValues.mode = 'collectionNames'
    req.templateValues.title = `Collection Name: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this collection name`
    searchFilter = `(per_page: ${perPage}, page: ${page}, collectionName: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'department') {
    req.templateValues.mode = 'departments'
    req.templateValues.title = `Department: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this department`
    searchFilter = `(per_page: ${perPage}, page: ${page}, department: "${newFilter}", lang:"${req.templateValues.dbLang}")`
  }

  if (req.params.thing === 'style') {
    req.templateValues.mode = 'styles'
    req.templateValues.title = `Style: ${newFilter}`
    req.templateValues.subTitle = `A collection of objects for this style`
    searchFilter = `(per_page: ${perPage}, page: ${page}, style: "${newFilter}", lang:"${req.templateValues.dbLang}")`
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

  if (req.params.thing === 'recommendedMissingImages') {
    req.templateValues.mode = 'recommendedMissingImages'
    req.templateValues.title = `Recommended Objects Missing Images`
    req.templateValues.subTitle = `Recommended objects which have images assigned but are missing them`
    perPage = 200
    page = 0
    searchFilter = `(per_page: ${perPage}, page: ${page}, isRecommended: true, hasImage: true, missingPrimaryImage: ${newFilter}, lang:"${req.templateValues.dbLang}")`
  }

  if (req.path.indexOf('explore-o-matic/archives') >= 0) {
    perPage = 100
    req.templateValues.isArchives = true
    req.templateValues.mode = 'archives'
    req.templateValues.title = 'Archives'
    req.templateValues.subTitle = `These are the objects that represent archives`
    searchFilter = `(per_page: ${perPage}, page: ${page}, archivalLevel: "Fonds", lang:"${req.templateValues.dbLang}")`
  }

  //  Grab all the different maker types
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query
  const preObjectsTime = new Date().getTime()
  const results = await graphQL.fetch(payload)
  const getObjectsQuery = new Date().getTime() - preObjectsTime
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
      const objects = stubObjects(contrastColors(results.data[thisQuery]))

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

  const pageEnd = new Date().getTime()

  req.templateValues.timing = {
    getObjectsQuery,
    totalQueryTime: (getObjectsQuery),
    totalNotQueryTime: (pageEnd - pageStart) - (getObjectsQuery),
    pageGenerationTime: pageEnd - pageStart
  }

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
      req.templateValues.objects = stubObjects(contrastColors(results.data[thisQuery]))
    }
  }

  req.templateValues.mode = 'color'
  return res.render('explore-o-matic/colour', req.templateValues)
}

exports.getObject = async (req, res) => {
  //  Make sure we are an admin user
  const pageStart = new Date().getTime()

  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const queries = new Queries()
  const graphQL = new GraphQL()

  const config = new Config()

  //  Find out if we are dealing with looking at an object or an "archive" (which
  //  if really an object)
  let urlStub = 'object'
  let isArchive = false
  let isObjectNumber = false

  if (req.path.indexOf('/archive') >= 0) {
    urlStub = 'archive'
    isArchive = true
    req.templateValues.mode = 'archives'
  }

  if (req.path.indexOf('/objectNumber') >= 0) {
    urlStub = 'objectNumber'
    isObjectNumber = true
    req.templateValues.mode = 'archives'
  }

  const baseTMS = config.getRootTMS()
  if (baseTMS === null) {
    return res.render(`explore-o-matic/${urlStub}`, req.templateValues)
  }

  const elasticsearchConfig = config.get('elasticsearch')
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `objects_${baseTMS}`
  const type = 'object'

  //  This is the initial search query we are going to use to grab all the objects
  let thisQuery = 'object'
  const newFilter = parseInt(req.params.filter, 10)
  let searchFilter = `(id: ${newFilter}, lang:"${req.templateValues.dbLang}")`

  //  If we are searching by object number
  if (isObjectNumber) {
    thisQuery = 'objects'
    searchFilter = `(objectNumber: "${req.params.filter}", lang:"${req.templateValues.dbLang}")`
  }

  //  Grab the query to get the object
  const query = queries.get(thisQuery, searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query
  let object = null
  const preObjectTime = new Date().getTime()
  const results = await graphQL.fetch(payload)
  const getObjectQuery = new Date().getTime() - preObjectTime
  if (results.data && results.data[thisQuery]) {
    if (isObjectNumber) {
      object = stubObjects(contrastColors(results.data[thisQuery])).filter((object) => object.objectNumber === req.params.filter)[0]
    } else {
      object = stubObjects(contrastColors([results.data[thisQuery]]))[0]
    }
    //  See if we have been passed an bump action, if so we need to adjust the
    //  popularCount
    if (object && req.body.bumpPopular) {
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
        if (isArchive) {
          res.redirect(`/explore-o-matic/archive/${req.params.filter}#admintools`)
        } else {
          if (object) {
            res.redirect(`/explore-o-matic/object/${object.id}#admintools`)
          } else {
            res.redirect(`/explore-o-matic`)
          }
        }
      }, 3000)
    }

    //  Stub up the related objects
    if (object && object.relatedObjects) {
      if (!Array.isArray(object.relatedObjects)) object.relatedObjects = [object.relatedObjects]
      object.relatedObjects = stubObjects(contrastColors(object.relatedObjects))
    }
    req.templateValues.object = object

    //  As we have an object we need to go through and grab all the shortcodes
    const shortCodes = []

    //  1st the constituents
    if (object && object.constituents) {
      object.constituents.forEach((constituent) => {
        shortCodes.push(`[[constituent|${constituent.name}|${constituent.id}]]`)
      })
    }
    //  Now the area, category and archivalLevel
    if (object && object.classification) {
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
    if (object && object.medium) {
      shortCodes.push(`[[medium|${object.medium.title}|${object.medium.stub}]]`)
    }
    //  objectName
    if (object && object.objectName) {
      shortCodes.push(`[[objectName|${object.objectName.title}|${object.objectName.stub}]]`)
    }
    //  objectStatus
    if (object && object.objectStatus) {
      shortCodes.push(`[[objectStatus|${object.objectStatus.title}|${object.objectStatus.stub}]]`)
    }
    //  collectionType
    if (object && object.collectionType) {
      shortCodes.push(`[[collectionType|${object.collectionType}|${object.collectionType}]]`)
    }
    //  collectionCode
    if (object && object.collectionCode) {
      shortCodes.push(`[[collectionCode|${object.collectionCode}|${object.collectionCode}]]`)
    }
    req.templateValues.shortCodes = shortCodes
  }

  //  If we have an action the we want to set something on this object, we need
  //  to do that here
  if (object && req.body.action) {
    //  If the action is to toggle the recommended value then we need to do that
    if (req.body.action === 'toggleRecommended') {
      let isRecommended = false
      if (req.body.recommended && req.body.recommended === 'true') isRecommended = true
      //  Check to see if there's any blurb, if so we need to set there here
      const body = {
        doc: {
          id: object.id,
          isRecommended
        },
        doc_as_upsert: true
      }

      const blurb = {}
      if (!req.body.blurb) req.body.blurb = null
      blurb[req.templateValues.dbLang] = req.body.blurb
      body.doc.recommendedBlurb = blurb

      const blurbExternalUrl = {}
      if (!req.body.blurbExternalUrl) req.body.blurbExternalUrl = null
      blurbExternalUrl[req.templateValues.dbLang] = req.body.blurbExternalUrl
      body.doc.blurbExternalUrl = blurbExternalUrl
      //  Update the database
      await esclient.update({
        index,
        type,
        id: object.id,
        body
      })

      //  Kill the cache
      await graphQL.fetch({
        query: queries.get('killCache', '')
      })
      return setTimeout(() => {
        if (isArchive) {
          res.redirect(`/explore-o-matic/archive/${req.params.filter}#admintools`)
        } else {
          if (object) {
            res.redirect(`/explore-o-matic/object/${object.id}#admintools`)
          } else {
            res.redirect(`/explore-o-matic`)
          }
        }
      }, 1000)
    }
  }

  //  If we are an archive object, then we need to go grab some more stuff
  let getNotObjectQuery = 0
  let getYesObjectQuery = 0
  if (isArchive && object && object.collectionCode && object.collectionCode !== '') {
    let perPage = 60
    let page = 0
    thisQuery = 'objects'
    searchFilter = `(per_page: ${perPage}, page: ${page}, collectionCode: "${object.collectionCode}", onlyNotObjects: true)`

    const preNotObjectTime = new Date().getTime()
    let notObjects = await graphQL.fetch({
      query: queries.get(thisQuery, searchFilter)
    })
    getNotObjectQuery = new Date().getTime() - preNotObjectTime

    if (notObjects.data && notObjects.data.objects) {
      req.templateValues.notObjects = stubObjects(contrastColors(notObjects.data.objects)).map((object) => {
        if (object.id === newFilter) return false
        return object
      }).filter(Boolean)
    }

    perPage = 60
    if (req.params.page) page = parseInt(req.params.page, 10) - 1
    if (isNaN(page)) page = 0
    if (page < 0) page = 0
    searchFilter = `(per_page: ${perPage}, page: ${page}, collectionCode: "${object.collectionCode}", onlyObjects: true)`
    const preYesObjectTime = new Date().getTime()
    let yesObjects = await graphQL.fetch({
      query: queries.get(thisQuery, searchFilter)
    })
    getYesObjectQuery = new Date().getTime() - preYesObjectTime

    if (yesObjects.data && yesObjects.data.objects) {
      req.templateValues.yesObjects = stubObjects(contrastColors(yesObjects.data.objects)).map((object) => {
        if (object.id === newFilter) return false
        return object
      }).filter(Boolean)
      let pagination = {}
      if (req.templateValues.yesObjects.length > 0) {
        pagination = req.templateValues.yesObjects[0]._sys.pagination
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

      pagination.target = `/explore-o-matic/archive`
      if (req.params.filter) pagination.target += `/${req.params.filter}`
      pagination.target += `/page/`
      req.templateValues.pagination = pagination
    }
  }
  const pageEnd = new Date().getTime()

  req.templateValues.timing = {
    getObjectQuery,
    getNotObjectQuery,
    getYesObjectQuery,
    totalQueryTime: (getObjectQuery + getNotObjectQuery + getYesObjectQuery),
    totalNotQueryTime: (pageEnd - pageStart) - (getObjectQuery + getNotObjectQuery + getYesObjectQuery),
    pageGenerationTime: pageEnd - pageStart
  }

  if (isArchive) {
    return res.render(`explore-o-matic/${urlStub}`, req.templateValues)
  }
  return res.render(`explore-o-matic/object`, req.templateValues)
}

exports.factpedia = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  Work out if we are on the factpedia or popularSearches, 'cause
  //  we'll be needing to know this
  const isFactpedia = (req.path.indexOf('factpedia') >= 0)
  let returnUrl = '/explore-o-matic/factpedia'
  let template = 'factpedia'

  if (isFactpedia) {
    req.templateValues.mode = 'factpedia'
  } else {
    req.templateValues.mode = 'popularSearches'
    returnUrl = '/explore-o-matic/popularSearches'
    template = 'popularSearches'
  }

  if (req.body.action) {
    //  Get all the elastic search stuff
    const config = new Config()

    const baseTMS = config.getRootTMS()
    if (baseTMS === null) {
      return res.render('explore-o-matic/factpedia', req.templateValues)
    }

    const elasticsearchConfig = config.get('elasticsearch')
    if (elasticsearchConfig === null) {
      return res.render('explore-o-matic/factpedia', req.templateValues)
    }
    const esclient = new elasticsearch.Client(elasticsearchConfig)
    const index = `factoids_${baseTMS}`
    const type = 'factoid'

    const graphQL = new GraphQL()
    const queries = new Queries()

    if (req.body.action.indexOf('deleteFactoid') >= 0) {
      const splitAction = req.body.action.split('|')
      if (splitAction.length === 2) {
        const id = splitAction[1]
        await esclient.delete({
          index,
          type,
          id
        })
        //  Kill the cache
        await graphQL.fetch({
          query: queries.get('killCache', '')
        })
        return setTimeout(() => {
          res.redirect(returnUrl)
        }, 2000)
      }
    }

    if (req.body.action === 'addFactoid') {
      //  Build a new record to enter
      //  Create the index if we need to
      const exists = await esclient.indices.exists({
        index
      })
      if (exists === false) {
        await esclient.indices.create({
          index
        })
      }

      const body = {
        fact: {
          en: req.body.factoidEN,
          'zh-hant': req.body.factoidTC
        },
        isConstituent: (req.body.isConstituent === 'true'),
        isArea: (req.body.isArea === 'true'),
        isCategory: (req.body.isCategory === 'true'),
        isMedium: (req.body.isMedium === 'true'),
        isArchive: (req.body.isArchive === 'true'),
        isColour: (req.body.isColour === 'true'),
        isRecommended: (req.body.isRecommended === 'true'),
        isCollection: (req.body.isCollection === 'true'),
        isMain: (req.body.isMain === 'true'),
        isPopular: (req.body.isPopular === 'true'),
        keyword: []
      }
      if (req.body.keyword) {
        body.keyword = req.body.keyword.split(',').map((word) => word.trim())
      }
      await esclient.index({
        index,
        type,
        body
      })
      //  Kill the cache
      await graphQL.fetch({
        query: queries.get('killCache', '')
      })
      return setTimeout(() => {
        res.redirect(returnUrl)
      }, 2000)
    }

    if (req.body.action === 'updateFactoids') {
      const bulkThisArray = []
      const newFacts = {}
      Object.entries(req.body).forEach((thing) => {
        const key = thing[0]
        const value = thing[1]
        const keySplit = key.split('|')
        const id = keySplit[0]
        let field = null
        if (keySplit.length === 2) {
          field = keySplit[1]
          if (!newFacts[id]) {
            newFacts[id] = {
              fact: {
                en: null,
                'zh-hant': null
              },
              isConstituent: false,
              isArea: false,
              isCategory: false,
              isMedium: false,
              isArchive: false,
              isColour: false,
              isRecommended: false,
              isCollection: false,
              isMain: false,
              isPopular: false,
              keyword: []
            }
          }
          if (field === 'factoidEN') newFacts[id].fact.en = value
          if (field === 'factoidTC') newFacts[id].fact['zh-hant'] = value
          if (field === 'isConstituent') newFacts[id].isConstituent = true
          if (field === 'isArea') newFacts[id].isArea = true
          if (field === 'isCategory') newFacts[id].isCategory = true
          if (field === 'isMedium') newFacts[id].isMedium = true
          if (field === 'isArchive') newFacts[id].isArchive = true
          if (field === 'isColour') newFacts[id].isColour = true
          if (field === 'isRecommended') newFacts[id].isRecommended = true
          if (field === 'isCollection') newFacts[id].isCollection = true
          if (field === 'isMain') newFacts[id].isMain = true
          if (field === 'isPopular') newFacts[id].isPopular = true
          if (field === 'keyword') {
            newFacts[id].keyword = value.split(',').map((word) => word.trim())
          }
        }
      })

      Object.entries(newFacts).forEach((factThing) => {
        const _id = factThing[0]
        const doc = factThing[1]
        bulkThisArray.push({
          update: {
            _id
          }
        })
        bulkThisArray.push({
          doc
        })
      })

      if (bulkThisArray.length > 0) {
        await esclient.bulk({
          index,
          type,
          body: bulkThisArray
        })
        // Note that we want to rebuld the facts
        //  Kill the cache
        await graphQL.fetch({
          query: queries.get('killCache', '')
        })
        return setTimeout(() => {
          res.redirect(returnUrl)
        }, 2000)
      }
    }
  }

  //  Go and get the factoids
  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000, isPopular: false)`
  if (!isFactpedia) {
    searchFilter = `(per_page: 5000, isPopular: true)`
  }

  //  Grab all the different maker types
  const query = queries.get('factoids', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.factoids) req.templateValues.factoids = results.data.factoids

  return res.render(`explore-o-matic/${template}`, req.templateValues)
}

exports.randomizer = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  Work out if we are on the randomizer or popularSearches, 'cause
  //  we'll be needing to know this
  const isRandomizer = (req.path.indexOf('randomizer') >= 0)
  let returnUrl = '/explore-o-matic/randomizer'
  let template = 'randomizer'

  if (isRandomizer) {
    req.templateValues.mode = 'randomizer'
  } else {
    req.templateValues.mode = 'popularSearches'
    returnUrl = '/explore-o-matic/popularSearches'
    template = 'popularSearches'
  }

  if (req.body.action) {
    //  Get all the elastic search stuff
    const config = new Config()

    const baseTMS = config.getRootTMS()
    if (baseTMS === null) {
      return res.render('explore-o-matic/randomizer', req.templateValues)
    }

    const elasticsearchConfig = config.get('elasticsearch')
    if (elasticsearchConfig === null) {
      return res.render('explore-o-matic/randomizer', req.templateValues)
    }
    const esclient = new elasticsearch.Client(elasticsearchConfig)
    const index = `randoms_${baseTMS}`
    const type = 'random'

    const graphQL = new GraphQL()
    const queries = new Queries()

    if (req.body.action.indexOf('deleteRandom') >= 0) {
      const splitAction = req.body.action.split('|')
      if (splitAction.length === 2) {
        const id = splitAction[1]
        await esclient.delete({
          index,
          type,
          id
        })
        //  Kill the cache
        await graphQL.fetch({
          query: queries.get('killCache', '')
        })
        return setTimeout(() => {
          res.redirect(returnUrl)
        }, 2000)
      }
    }

    if (req.body.action === 'addRandom') {
      //  Build a new record to enter
      //  Create the index if we need to
      const exists = await esclient.indices.exists({
        index
      })
      if (exists === false) {
        await esclient.indices.create({
          index
        })
      }

      const body = {
        random: {
          en: req.body.randomEN,
          'zh-hant': req.body.randomTC
        }
      }
      await esclient.index({
        index,
        type,
        body
      })
      //  Kill the cache
      await graphQL.fetch({
        query: queries.get('killCache', '')
      })
      return setTimeout(() => {
        res.redirect(returnUrl)
      }, 2000)
    }

    if (req.body.action === 'updateRandoms') {
      const bulkThisArray = []
      const newRandoms = {}
      Object.entries(req.body).forEach((thing) => {
        const key = thing[0]
        const value = thing[1]
        const keySplit = key.split('|')
        const id = keySplit[0]
        let field = null
        if (keySplit.length === 2) {
          field = keySplit[1]
          if (!newRandoms[id]) {
            newRandoms[id] = {
              random: {
                en: null,
                'zh-hant': null
              }
            }
          }
          if (field === 'randomEN') newRandoms[id].random.en = value
          if (field === 'randomTC') newRandoms[id].random['zh-hant'] = value
        }
      })

      Object.entries(newRandoms).forEach((randomThing) => {
        const _id = randomThing[0]
        const doc = randomThing[1]
        bulkThisArray.push({
          update: {
            _id
          }
        })
        bulkThisArray.push({
          doc
        })
      })

      if (bulkThisArray.length > 0) {
        await esclient.bulk({
          index,
          type,
          body: bulkThisArray
        })
        // Note that we want to rebuld the randoms
        //  Kill the cache
        await graphQL.fetch({
          query: queries.get('killCache', '')
        })
        return setTimeout(() => {
          res.redirect(returnUrl)
        }, 2000)
      }
    }
  }

  //  Go and get the randoms
  const queries = new Queries()
  const graphQL = new GraphQL()

  //  This is the initial search query we are going to use to grab all the constituents
  let searchFilter = `(per_page: 5000)`
  if (!isRandomizer) {
    searchFilter = `(per_page: 5000)`
  }

  //  Grab all the different maker types
  const query = queries.get('randoms', searchFilter)
  const payload = {
    query
  }
  req.templateValues.query = query

  const results = await graphQL.fetch(payload)
  if (results.data && results.data.randoms) req.templateValues.randoms = results.data.randoms

  return res.render(`explore-o-matic/${template}`, req.templateValues)
}