import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Regex to match ES imports and exports of relative paths
  // Matches: import ... from './something'; export ... from './something';
  const importExportRegex = /(import|export)\s+(?:(?:type\s+)?{?[^}]+}?\s+from\s+)?['"](\.[^'"]+)['"]/g;

  content = content.replace(importExportRegex, (match, type, relativePath) => {
    // If it already ends with .js or .json, skip
    if (relativePath.endsWith('.js') || relativePath.endsWith('.json')) {
      return match;
    }

    const dirOfFile = path.dirname(filePath);
    const resolvedPath = path.resolve(dirOfFile, relativePath);

    let newRelativePath = relativePath;
    
    // Check if it resolves to a directory with index.ts
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
        newRelativePath = relativePath.endsWith('/') ? `${relativePath}index.js` : `${relativePath}/index.js`;
      }
    } else {
      // Must be a file
      newRelativePath = `${relativePath}.js`;
    }

    changed = true;
    return match.replace(/['"](\.[^'"]+)['"]/, `'${newRelativePath}'`);
  });

  // Also handle dynamic imports: import('./something')
  const dynamicImportRegex = /import\(['"](\.[^'"]+)['"]\)/g;
  content = content.replace(dynamicImportRegex, (match, relativePath) => {
    if (relativePath.endsWith('.js') || relativePath.endsWith('.json')) {
      return match;
    }
    const dirOfFile = path.dirname(filePath);
    const resolvedPath = path.resolve(dirOfFile, relativePath);
    let newRelativePath = relativePath;
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
        newRelativePath = relativePath.endsWith('/') ? `${relativePath}index.js` : `${relativePath}/index.js`;
      }
    } else {
      newRelativePath = `${relativePath}.js`;
    }
    changed = true;
    return `import('${newRelativePath}')`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated imports in ${filePath}`);
  }
}

const serverDir = path.join(__dirname, 'server');
if (fs.existsSync(serverDir)) {
  processDirectory(serverDir);
}

const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  processDirectory(apiDir);
}
