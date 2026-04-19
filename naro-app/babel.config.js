const createExpoBabelConfig = require("@naro/config/create-babel-config");

module.exports = function (api) {
  api.cache(true);
  return createExpoBabelConfig();
};
