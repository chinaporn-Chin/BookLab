const { getUser, json } = require('./_lib/auth');

exports.handler = async (event) => {
  const user = await getUser(event);
  return json(200, { user: user || null });
};
