const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');

module.exports = {
  runtimeCompiler: true,
  configureWebpack: {
      plugins: [new VuetifyLoaderPlugin()]
  },
  devServer: {
    proxy: {
      '^/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
    }
  },
  pwa: {
    iconPaths: {
       favicon32: 'src/assets/img/favicon.png',
    }
  }
}
