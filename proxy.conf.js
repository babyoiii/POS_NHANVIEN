module.exports = {
  '/api/google-script': {
    target: 'https://script.googleusercontent.com',
    secure: false,
    changeOrigin: true,
    pathRewrite: {
      '^/api/google-script': '/macros/echo?user_content_key=AehSKLgAa8-DFm_tWVp4X9VsWv3IcjVqRS6jhjyd36Oh5yKTMZrFJFKhu1tXvU90JollJUAYn0jYsI-wUdhohehlAVlfrhTeYrvJKxlkKib7IzxAWVDbb3XLSVYjzxcPfc-8aqnAEubydWXGSyCKxsV_FPIuOUy9ug7XbrXzZ6L9S5hpuQzG8CNwhGUKSI_dcNN3KQWHKJHN9qqoTrG87rZjL3ktibB49yfY-OZWA6zu59N991igReDtb8O8vfcrXMJZf7epMX52fcIhA5n2Sd67qfDM_VtWVepNXHAvkBNz&lib=MbobgF83VGNWrcCC3M4CGj24K8jOcnH58'
    },
    logLevel: 'debug',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'Accept': 'application/json, text/plain, */*'
    },
    onProxyRes: function(proxyRes, req, res) {
      // Xử lý phản hồi từ Google Script API
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
    }
  }
};
