// expects an array or single json object to update in elasticsearch

const getStdin = require('get-stdin')

const config = require('../config.json')
const elasticsearch = require('elasticsearch')
const esclient = new elasticsearch.Client(config.elasticsearch)

const artisanalints = require('../lib/artisanalints')

async function getArtisanalIdFromTmsId (tmsid) {
  const object = await esclient.search({q: `tmsid: ${tmsid}`})
  if (object.id) {
    console.log(`found id ${object.id}`)
    return object.id
  } else {
    const id = await artisanalints.createArtisanalInt()
    console.log(`created id ${id}`)
    return id
  }
}

async function addToElasticSearch (index, type, object) {
  console.log(object)
  const tmsid = object.id

  if (!tmsid) {
    return console.error(`object missing id, not adding`)
  }

  const id = await getArtisanalIdFromTmsId(tmsid)
  console.log(`tmsid ${tmsid} => id ${id}`)

  object.tmsid = tmsid
  object.id = id

  esclient.update({index, type, id, body: { doc: object, doc_as_upsert: true }})
    .then('updated')
}

module.exports = {
  json2elasticsearch: function () {
    getStdin()
      .then(jsonstring => {
        const json = JSON.parse(jsonstring)
        const index = Object.keys(json)[0]
        const objects = json[index]
        const type = Object.keys(objects[0])[0]

        addToElasticSearch(index, type, objects[0].object)
          /*
        esclient.indices.exists({index}).then(exists => {
          if (exists) {
            objects.forEach(object => {
              addToElasticSearch(index, type, object.object)
            })
          } else {
            esclient.indices.create({index}).then(() => {
              objects.forEach(object => {
                addToElasticSearch(index, type, object.object)
              })
            })
          }
        })
        */
      })
      .catch(error => {
        console.error(error)
        console.log(`json2elasticsearch

                    takes a json object or objects, adds an artisanal id, and updates in elasticsearch
    usage:

        yarn run tmsxml2json < ../data/ExportForDAM_Objects_UCS.xml | yarn run json2elasticsearch`)
      })
  }
}
