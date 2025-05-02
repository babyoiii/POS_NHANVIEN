const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/google-script',
    createProxyMiddleware({
      target: 'https://script.google.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/google-script': '/macros/s/AKfycbwQXAKgVy_WbvLPnUm_xtJK9JbC6CHHYRQgJrH1wQAa1u35YCO_fnQSFmbFImmjgz-AW1WChXBTI8nE_7k/exec'
      },
      secure: false,
      logLevel: 'debug',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      onProxyRes: function(proxyRes, req, res) {
        // Xử lý phản hồi từ Google Script API
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      }
    })
  );
};
