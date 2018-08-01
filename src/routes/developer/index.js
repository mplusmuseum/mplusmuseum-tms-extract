// const Queries = require('../../classes/queries')

exports.index = (req, res) => {
  return res.render('developer/index', req.templateValues)
}

exports.graphql = (req, res) => {
  // req.templateValues.queries = new Queries()
  return res.render('developer/graphql', req.templateValues)
}

exports.status = {
  graphql: (req, res) => {
    req.templateValues.graphqlping = global.graphqlping
    return res.render('developer/status/graphql', req.templateValues)
  },
  elasticsearch: (req, res) => {
    req.templateValues.elasticsearchping = global.elasticsearchping
    return res.render('developer/status/elasticsearch', req.templateValues)
  }
}