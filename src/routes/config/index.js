const Config = require('../../classes/config')
// const cloudinary = require('../../modules/cloudinary')
// const elasticsearch = require('../../modules/elasticsearch')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true) {
    return res.redirect('/')
  }

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {
    const config = new Config()

    //  ADD/UPDATE GRAPHQL
    if (req.body.action === 'updategraphql' && 'graphql' in req.body && req.body.graphql !== '') {
      config.set('graphql', {
        host: req.body.graphql
      })
      const pingtools = require('../../modules/pingtools')
      pingtools.pingGraphQL()
      return res.redirect('/config')
    }

    //  ADD/UPDATE ELASTIC SEARCH
    if (req.body.action === 'updateelasticsearch' && 'elasticsearch' in req.body && req.body.elasticsearch !== '') {
      config.set('elasticsearch', {
        host: req.body.elasticsearch
      })
      const pingtools = require('../../modules/pingtools')
      pingtools.pingES()

      //  If we've been passed an interval, then we need to set that
      //  and restart the interval timer.
      //  Otherwise set it the default value of 20,000ms
      if ('interval' in req.body && req.body.interval !== '') {
        try {
          const newInterval = parseInt(req.body.interval, 10)
          if (newInterval > 0) {
            config.set('timers.elasticsearch', parseInt(req.body.interval, 10))
            /*
            elasticsearch.startUpserting()
            elasticsearch.startUpsertingEvents()
            elasticsearch.startUpsertingExhibitions()
            */
          }
        } catch (err) {
          console.error(err)
        }
      } else {
        config.set('timers.elasticsearch', 20000)
        /*
        elasticsearch.startUpserting()
        elasticsearch.startUpsertingEvents()
        elasticsearch.startUpsertingExhibitions()
        */
      }

      return res.redirect('/config')
    }

    //  ADD/UPDATE SPELUNKER
    if (req.body.action === 'updatespelunker' && 'spelunker' in req.body && req.body.spelunker !== '') {
      config.set('spelunker', {
        host: req.body.spelunker
      })
      return res.redirect('/config')
    }

    //  ADD/UPDATE TMS
    if (req.body.action === 'updatetms' && 'tmsstub' in req.body && req.body.tmsstub !== '' && 'tmsurl' in req.body && req.body.tmsurl !== '' && 'key' in req.body && req.body.key !== '') {
      //  If there's no TMS entry in config, then we create it
      if (config.get('tms') === null) {
        config.set('tms', [])
      }
      //  Now get the config again
      const tms = config.get('tms')
      //  Loop through them seeing if we already have an entry, if so update it
      let foundMatch = false
      tms.forEach((thisTMS) => {
        if (thisTMS.stub === req.body.tmsstub) {
          thisTMS.url = req.body.tmsurl
          thisTMS.key = req.body.key
          foundMatch = true
        }
      })
      if (foundMatch === false) {
        tms.push({
          stub: req.body.tmsstub,
          url: req.body.tmsurl,
          key: req.body.key
        })
      }
      config.set('tms', tms)
      return res.redirect('/config')
    }

    //  DELETE TMS
    if (req.body.action === 'deletetms' && 'tmsstub' in req.body && req.body.tmsstub !== '') {
      const tms = config.get('tms')
      if (tms !== null) {
        const newtms = tms.filter((thisTMS) => {
          return thisTMS.stub !== req.body.tmsstub
        })
        config.set('tms', newtms)
        return res.redirect('/config')
      }
    }

    //  ADD/UPDATE CLOUDINARY
    if (req.body.action === 'updatecloudinary' && 'cloud_name' in req.body && req.body.cloud_name !== '' && 'api_key' in req.body && req.body.api_key !== '' && 'api_secret' in req.body && req.body.api_secret !== '') {
      //  If there's no TMS entry in config, then we create it

      config.set('cloudinary', {
        cloud_name: req.body.cloud_name,
        api_key: req.body.api_key,
        api_secret: req.body.api_secret
      })

      //  If we've been passed an interval, then we need to set that
      //  and restart the interval timer.
      //  Otherwise set it the default value of 20,000ms
      if ('interval' in req.body && req.body.interval !== '') {
        try {
          const newInterval = parseInt(req.body.interval, 10)
          if (newInterval > 0) {
            config.set('timers.cloudinary', parseInt(req.body.interval, 10))
            /*
            cloudinary.startUploading()
            */
          }
        } catch (err) {
          console.error(err)
        }
      } else {
        config.set('timers.cloudinary', 20000)
        /*
        cloudinary.startUploading()
        */
      }

      //  Same for color interval
      if ('intervalColor' in req.body && req.body.intervalColor !== '') {
        try {
          const newIntervalColor = parseInt(req.body.intervalColor, 10)
          if (newIntervalColor > 0) {
            config.set('timers.cloudinaryColoring', parseInt(req.body.intervalColor, 10))
            /*
            cloudinary.startColoring()
            */
          }
        } catch (err) {
          console.error(err)
        }
      } else {
        config.set('timers.intervalColor', 20000)
        /*
        cloudinary.startColoring()
        */
      }

      return res.redirect('/config')
    }
  }

  //  Get the domain we are going to be connected to
  req.templateValues.host = req.headers.host

  return res.render('config/index', req.templateValues)
}
