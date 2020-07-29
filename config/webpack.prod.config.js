// This is the prod Webpack config. All settings here should prefer smaller,
// optimized bundles at the expense of a longer build time.
const Merge = require('webpack-merge');
const path = require('path');
const Dotenv = require('dotenv-webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackNewRelicPlugin = require('html-webpack-new-relic-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const PostCssRtlPlugin = require('postcss-rtl');
const PostCssAutoprefixerPlugin = require('autoprefixer');
const CssNano = require('cssnano');

const commonConfig = require('./webpack.common.config.js');
const presets = require('../lib/presets');

module.exports = Merge.smart(commonConfig, {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename: '[name].[chunkhash].js',
    path: path.resolve(process.cwd(), 'dist'),
  },
  module: {
    // Specify file-by-file rules to Webpack. Some file-types need a particular kind of loader.
    rules: [
      // The babel-loader transforms newer ES2015+ syntax to older ES5 for older browsers.
      // Babel is configured with the .babelrc file at the root of the project.
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules\/(?!@edx)/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: presets.babel.resolvedFilepath,
          },
        },
      },
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre',
      },
      // Webpack, by default, includes all CSS in the javascript bundles. Unfortunately, that means:
      // a) The CSS won't be cached by browsers separately (a javascript change will force CSS
      // re-download).  b) Since CSS is applied asyncronously, it causes an ugly
      // flash-of-unstyled-content.
      //
      // To avoid these problems, we extract the CSS from the bundles into separate CSS files that
      // can be included as <link> tags in the HTML <head> manually.
      //
      // We will not do this in development because it prevents hot-reloading from working and it
      // increases build time.
      {
        test: /(.scss|.css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader', // translates CSS into CommonJS
            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [
                PostCssRtlPlugin(),
                PostCssAutoprefixerPlugin({ grid: true }),
                CssNano(),
              ],
            },
          },
          'resolve-url-loader',
          {
            loader: 'sass-loader', // compiles Sass to CSS
            options: {
              sourceMap: true,
              includePaths: [
                path.join(process.cwd(), 'node_modules'),
                path.join(process.cwd(), 'src'),
              ],
            },
          },
        ],
      },
      {
        test: /.svg$/,
        issuer: {
          test: /\.jsx?$/,
        },
        loader: '@svgr/webpack',
      },
      // Webpack, by default, uses the url-loader for images and fonts that are required/included by
      // files it processes, which just base64 encodes them and inlines them in the javascript
      // bundles. This makes the javascript bundles ginormous and defeats caching so we will use the
      // file-loader instead to copy the files directly to the output directory.
      {
        test: /\.(woff2?|ttf|svg|eot)(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'file-loader',
      },
      {
        test: /favicon.ico$/,
        loader: 'file-loader?name=[name].[ext]', // <-- retain original file name
      },
      {
        test: /\.(jpe?g|png|gif)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          'file-loader',
          {
            loader: 'image-webpack-loader',
            options: {
              mozjpeg: {
                progressive: true,
                quality: 65,
              },
              gifsicle: {
                interlaced: false,
              },
              pngquant: {
                quality: [0.65, 0.90],
                speed: 4,
              },
            },
          },
        ],
      },
    ],
  },
  // New in Webpack 4. Replaces CommonChunksPlugin. Extract common modules among all chunks to one
  // common chunk and extract the Webpack runtime to a single runtime chunk.
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
    },
  },
  // Specify additional processing or side-effects done on the Webpack output bundles as a whole.
  plugins: [
    // Cleans the dist directory before each build
    new CleanWebpackPlugin(),
    // Writes the extracted CSS from each entry to a file in the output directory.
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].css',
    }),
    // Generates an HTML file in the output directory.
    new HtmlWebpackPlugin({
      inject: true, // Appends script tags linking to the webpack bundles at the end of the body
      template: path.resolve(process.cwd(), 'public/index.html'),
      optimizelyId: process.env.OPTIMIZELY_PROJECT_ID || null,
    }),
    new Dotenv({
      path: path.resolve(process.cwd(), '.env'),
      systemvars: true,
    }),
    new HtmlWebpackNewRelicPlugin({
      // This plugin fixes an issue where the newrelic script will break if
      //  not added directly to the HTML.
      // We use non empty strings as defaults here to prevent errors for empty configs
      license: process.env.NEW_RELIC_LICENSE_KEY || 'fake_app',
      applicationID: process.env.NEW_RELIC_APP_ID || 'fake_license',
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],
});
