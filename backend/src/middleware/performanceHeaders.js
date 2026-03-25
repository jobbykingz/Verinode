const performanceHeaders = (req, res, next) => {
  // Security and performance headers
  const headers = {
    // Caching headers
    'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for static assets
    'ETag': 'W/"v1"', // Weak ETag for better caching
    
    // Compression headers
    'Content-Encoding': 'gzip',
    'Vary': 'Accept-Encoding',
    
    // Browser optimization headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Performance hints
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Feature-Policy': 'geolocation \'none\'; microphone \'none\'; camera \'none\'',
    
    // Preload critical resources
    'Link': [
      '</static/js/main.js>; rel=preload; as=script',
      '</static/css/main.css>; rel=preload; as=style'
    ].join(', ')
  };

  // Apply different caching strategies based on content type
  const contentType = req.get('Content-Type') || '';
  
  if (contentType.includes('image/')) {
    // Images - cache for 1 year
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (contentType.includes('text/css') || contentType.includes('application/javascript')) {
    // CSS/JS - cache for 1 year with validation
    res.set('Cache-Control', 'public, max-age=31536000, must-revalidate');
  } else if (contentType.includes('text/html')) {
    // HTML - shorter cache for dynamic content
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 hour
  } else {
    // Default caching
    res.set('Cache-Control', 'public, max-age=86400'); // 1 day
  }

  // Apply common headers
  Object.entries(headers).forEach(([key, value]) => {
    if (!res.get(key)) {
      res.set(key, value);
    }
  });

  next();
};

module.exports = performanceHeaders;
