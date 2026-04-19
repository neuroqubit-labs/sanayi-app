const createExpoMetroConfig = require("@naro/config/create-metro-config");

module.exports = createExpoMetroConfig(__dirname, { nativeWindInput: "./global.css" });
