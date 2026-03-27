import fs from 'fs';
import path from 'path';

/**
 * General purpose documentation generator for Verinode
 * Indexing markdown files from docs/* and creating a manifest for the portal
 */

const docsDir = path.join(__dirname, '../docs');
const portalDir = path.join(__dirname, '../docs/portal/src');

const getMarkdownFiles = (dir: string, base: string = ''): any[] => {
  let results: any[] = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory() && file !== 'portal') {
      results = results.concat(getMarkdownFiles(filePath, path.join(base, file)));
    } else if (file.endsWith('.md')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const titleMatch = content.match(/^# (.*)/m);
      results.push({
        title: titleMatch ? titleMatch[1] : file,
        path: path.join(base, file).replace(/\\/g, '/'),
        category: base || 'general'
      });
    }
  });
  
  return results;
};

const main = () => {
    const manifest = getMarkdownFiles(docsDir);
    
    const manifestPath = path.join(portalDir, 'docs-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`[Docs Indexer] Indexed ${manifest.length} documentation contributors.`);
};

main();
