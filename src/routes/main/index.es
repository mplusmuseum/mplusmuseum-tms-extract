exports.index = async (request, response) => {
  const templateValues = {};
  templateValues.msg = 'Hello world!';

  //  Check to see if we've been passed an ID, if so redirect
  if ('body' in request && 'id' in request.body) {
    return response.redirect(`/object/${request.body.id}`);
  }

  return response.render('main/index', templateValues);
};
