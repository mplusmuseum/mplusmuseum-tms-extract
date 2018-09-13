exports.index = (req, res) => {
  return res.render('developer/index', req.templateValues)
}

exports.graphql = (req, res) => {
  let isVendor = false
  let loadFile = 'public'

  if (req.user && req.user.roles && 'isVendor' in req.user.roles) {
    isVendor = req.user.roles.isVendor
  }
  if (isVendor) loadFile = 'vendors'
  const Queries = require(`../../classes/queries/${loadFile}.js`)
  req.templateValues.queries = new Queries()
  req.templateValues.showVendor = isVendor

  return res.render('developer/graphql', req.templateValues)
}

exports.terms = (req, res) => {
  return res.render('developer/terms', req.templateValues)
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
