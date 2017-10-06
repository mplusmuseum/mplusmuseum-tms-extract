// expects an array or single json object to update in elasticsearch

const esIndex = 'mplusmuseum'
const request = require('request')
const getStdin = require('get-stdin')
const elasticsearch = require('elasticsearch')
const esclient = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'trace'
})

const createArtisinalId = (cb) => {
  request.post({
    url: 'http://api.brooklynintegers.com/rest/', 
    form: { method: 'brooklyn.integers.create' },
  }, cb)
}

const getArtisinalIdFromTmsId = (tmsid, cb) => {
  esclient.search({q: `tmsid: ${tmsid}`}, (error, response) => {
    if (error) console.error(error)

    if (response.hits.total !== 0) {
      cb(null, response.id)
    } else {
      createArtisinalId((error, response, body) => {
        if (error) {
          cb(error, null)
        } else {
          cb(null, JSON.parse(body).integers[0].integer)
        }
      })
    }
  })
}

const addToElasticSearch = object => {
  if (!object.id) {
      return console.error(`object missing id, not adding`)
  }

  getArtisinalIdFromTmsId(object.id, (error, artisinalid) => {
    console.log(`tmsid ${object.id} => id ${artisinalid}`)
    object.tmsid = object.id
    object.id = artisinalid

    esclient.exists({
        index: esIndex,
        type: 'artwork',
        id: object.id
    }, (error, exists) => {
      if (error) console.error(error);

      if (exists) {
        esclient.upsert({
          index: esIndex,
          id: `${object.id}`,
          type: 'artwork',
          doc: object,
          doc_as_upsert: true
        }, (error, body) => {
          if (error) console.error(error)
          console.log('upserted')
        })
      } else {
        esclient.create({
          index: esIndex,
          id: `${object.id}`,
          type: 'artwork',
          body: object,
        }, (error, body) => {
          if (error) console.error(error)
          console.log('inserted')
        })
      }
    })
  })
}

getStdin()
  .then(jsonstring => {
    const json = JSON.parse(jsonstring)
    if (Array.isArray(json)) {
      json.forEach(addToElasticSearch)
    } else if (json.id) {
      addToElasticSearch(json)
    }
  })
  .catch(error => {
    console.error(error)
    console.log(`json2elasticsearch

                takes a json object or objects, adds an artisinal id, and updates in elasticsearch
usage:

    yarn run tmsxml2json < ../data/ExportForDAM_Objects_UCS.xml | yarn run json2elasticsearch`)
  })
