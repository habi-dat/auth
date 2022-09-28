const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const port = 8080;

module.exports = {
  mode: "development",
  cache: false,
  devtool: "source-map",
  target: "web",
  optimization: {
    minimize: false
  },
  entry: path.resolve(__dirname, "./src/main.js"),
  output: {
    path: path.resolve(__dirname, "./dist"),
    publicPath: `http://localhost:${port}/`
  },
  resolve: {
    extensions: [".ts", ".js", ".vue", ".json"],
    alias: {
      vue: "vue/dist/vue.esm.js",
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, 'src/assets')
    }
  },
  module: {
    rules: [
      { test: /\.vue$/, loader: "vue-loader" },
      {
        test: /\.ts$/,
        loader: "ts-loader",
        options: { appendTsSuffixTo: [/\.vue$/] }
      },
      {
        test: /\.css|.sass|.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              esModule: false
            }
          },
          "css-loader",
          "sass-loader"
        ]
      },
      {
        test: /\.png$/,
        use: {
          loader: "url-loader",
          options: {
            esModule: false,
            name: "[name].[ext]",
            limit: 8192
          }
        }
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
      inject: true
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css"
    }), // Add this plugin to make use of process.env
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "public")
    },
    proxy: {
      "/api": "http://localhost:3000",
      "/saml": "http://localhost:3000"
    },
    compress: true,
    historyApiFallback: {
      rewrites: [
        { from: /.*/, to: path.posix.join('/', 'index.html') },
      ],
    },
    port,
    hot: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization",
    },
  },
};
