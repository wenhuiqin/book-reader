const path = require('path');

module.exports = {
  webpack: (config, env) => {
    config.output = {
      ...config.output,
      path: path.resolve(__dirname, 'build'),
      publicPath: './'
    };
    return config;
  }
};
