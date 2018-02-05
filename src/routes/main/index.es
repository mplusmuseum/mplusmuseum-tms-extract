exports.index = async (request, response) => {
  const templateValues = {};
  templateValues.msg = 'Hello world!';
  return response.render('main/index', templateValues);
};
