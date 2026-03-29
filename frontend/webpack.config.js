const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  // Verinode Optimized Webpack Config for high performance delivery
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 250000, // 250kb max chunk size for better parallelism
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
          name: 'vendors'
        },
        lib: {
          test(module) {
            return (
              module.size() > 160000 &&
              /node_modules[/\\]/.test(module.identifier())
            );
          },
          name(module) {
            const hash = crypto.createHash('md5');
            hash.update(module.libIdent({ context: 'root' }));
            return `lib.${hash.digest('hex').substring(0, 8)}`;
          },
          priority: 10,
          minChunks: 1,
          reuseExistingChunk: true,
        },
      },
    },
    runtimeChunk: 'single',
  },
  plugins: [
    // Automatically generate bundle reports on build
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ]
};
