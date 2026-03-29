const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const path = require('path');

const compressImages = async () => {
  try {
    console.log('🖼️  Starting image compression...');
    
    const files = await imagemin(['public/**/*.{jpg,jpeg,png}'], {
      destination: 'public/optimized',
      plugins: [
        imageminMozjpeg({ quality: 85, progressive: true }),
        imageminPngquant({ quality: [0.65, 0.8], speed: 4 })
      ]
    });

    console.log(`✅ Compressed ${files.length} images`);
    console.log('📊 Compression results:');
    files.forEach(file => {
      const originalSize = file.sourcePath ? 
        require('fs').statSync(file.sourcePath).size : 0;
      const compressedSize = file.data.length;
      const savings = originalSize > 0 ? 
        ((originalSize - compressedSize) / originalSize * 100).toFixed(2) : 0;
      
      console.log(`   ${path.basename(file.destinationPath)}: ${savings}% reduction`);
    });

  } catch (error) {
    console.error('❌ Error compressing images:', error);
    process.exit(1);
  }
};

compressImages();
