import fs from 'fs';
import path from 'path';

/**
 * Automates the generation of API documentation by scanning backend routes and controllers
 */
interface ApiRoute {
  path: string;
  method: string;
  description: string;
  params: string[];
  response: string;
}

const routesDir = path.join(__dirname, '../backend/src/routes');
const outputDir = path.join(__dirname, '../docs/api');

const generateApiDocs = () => {
  const files = fs.readdirSync(routesDir);
  const allRoutes: ApiRoute[] = [];

  files.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
      
      // Simple regex parser for Express routes (very basic for this exercise)
      const routeMatches = content.matchAll(/router\.(get|post|put|delete)\(['"](.*?)['"]/g);
      
      for (const match of routeMatches) {
        allRoutes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          description: `Auto-generated endpoint definition for ${match[2]} in ${file}`,
          params: [],
          response: 'JSON'
        });
      }
    }
  });

  // Generate individual Markdown files for each API group
  const groupedRoutes = allRoutes.reduce((acc, route) => {
    const group = route.path.split('/')[1] || 'general';
    if (!acc[group]) acc[group] = [];
    acc[group].push(route);
    return acc;
  }, {} as Record<string, ApiRoute[]>);

  for (const [group, routes] of Object.entries(groupedRoutes)) {
    const mdContent = `# ${group.toUpperCase()} API Reference\n\n` + 
      routes.map(r => `## ${r.method} ${r.path}\n\n**Description:** ${r.description}\n\n**Response:** \`${r.response}\`\n\n---\n`).join('\n');
    
    fs.writeFileSync(path.join(outputDir, `${group}.md`), mdContent);
  }

  console.log(`[Docs Generator] Generated ${Object.keys(groupedRoutes).length} API documentation files.`);
};

generateApiDocs();
