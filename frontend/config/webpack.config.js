const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const path = require('path');

module.exports = {
  webpack: function(config, env) {
    // Production optimizations
    if (env === 'production') {
      // Minify JavaScript
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        })
      );

      // Minify CSS
      config.optimization.minimizer.push(
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: [
              'default',
              {
                discardComments: { removeAll: true },
                normalizeWhitespace: true,
              },
            ],
          },
        })
      );

      // Add compression for assets
      config.plugins.push(
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        })
      );

      // Image optimization
      config.module.rules.push({
        test: /\.(jpe?g|png|gif|webp)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[contenthash].[ext]',
              outputPath: 'images/',
            },
          },
          {
            loader: 'img-optimize-loader',
            options: {
              gifsicle: { optimizationLevel: 7 },
              mozjpeg: { quality: 85 },
              pngquant: { quality: [0.65, 0.8] },
              svgo: {
                plugins: [
                  { removeViewBox: false },
                  { removeEmptyAttrs: false },
                ],
              },
            },
          },
        ],
      });
    }

    // Add lazy loading for images
    config.module.rules.push({
      test: /\.(jpe?g|png|gif|webp)$/i,
      use: [
        {
          loader: 'lazy-image-loader',
          options: {
            placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
            threshold: 100,
          },
        },
      ],
    });

    return config;
  },
};
