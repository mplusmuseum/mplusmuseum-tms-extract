// expects an array or single json object to update in elasticsearch

const getStdin = require('get-stdin')

const elasticsearch = require('elasticsearch')
const esclient = new elasticsearch.Client({host: 'localhost:9200'})

const artisinalints = require('../lib/artisinalints')

async function getArtisinalIdFromTmsId (tmsid) {
  const object = await esclient.search({q: `tmsid: ${tmsid}`})
  if (object.id) {
    console.log(`found id ${object.id}`)
    return object.id
  } else {
    const id = await artisinalints.createArtisinalInt()
    console.log(`created id ${id}`)
    return id
  }
}

async function addToElasticSearch (object) {
  const tmsid = object.id

  if (!tmsid) {
    return console.error(`object missing id, not adding`)
  }

  const id = await getArtisinalIdFromTmsId(tmsid)
  console.log(`tmsid ${tmsid} => id ${id}`)

  const index = 'mplusmuseum'
  const type = 'artwork'

  object.tmsid = tmsid
  object.id = id

  const exists = await esclient.exists({index, type, id})

  if (exists) {
    esclient.upsert({index, type, id, doc: object, doc_as_upsert: true})
      .then(console.log('upserted'))
  } else {
    esclient.create({index, type, id, body: object})
      .then(console.log('created'))
  }
}

module.exports = {
  json2elasticsearch: function () {
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
  }
}
