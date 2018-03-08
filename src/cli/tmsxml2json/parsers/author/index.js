const parseAuthor = a => ({
  id: parseInt(a.id, 10)
})

exports.parseJson = json => parseAuthor(json)
