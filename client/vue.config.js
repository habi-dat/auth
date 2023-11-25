const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');

module.exports = {
  runtimeCompiler: true,
  configureWebpack: {
      plugins: [new VuetifyLoaderPlugin()]
  },
  devServer: {
    allowedHosts: "all",
    proxy: {
      '^/api': {
        target: 'http://auth-backend:3000',
        changeOrigin: true,
      },
    }
  },
  pwa: {
    iconPaths: {
       favicon32: 'src/assets/img/favicon.png',
    }
  }
}
