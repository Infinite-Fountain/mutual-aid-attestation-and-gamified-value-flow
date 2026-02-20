#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const FILES_FOR_AGENTS_DIR = __dirname;
const INDEX_FILE = path.join(FILES_FOR_AGENTS_DIR, 'index.html');

// Get all folders in files-for-agents (excluding hidden folders and index.html)
function getFolders() {
  const items = fs.readdirSync(FILES_FOR_AGENTS_DIR, { withFileTypes: true });
  return items
    .filter(item => item.isDirectory() && !item.name.startsWith('.'))
    .map(item => item.name)
    .sort();
}

// Get all markdown files in a folder
function getMarkdownFiles(folderName) {
  const folderPath = path.join(FILES_FOR_AGENTS_DIR, folderName);
  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    return items
      .filter(item => item.isFile() && item.name.endsWith('.md'))
      .map(item => item.name)
      .sort();
  } catch (err) {
    return [];
  }
}

// Generate HTML
function generateHTML() {
  const folders = getFolders();
  
  let foldersHTML = '';
  
  folders.forEach(folder => {
    const files = getMarkdownFiles(folder);
    if (files.length === 0) return; // Skip empty folders
    
    const filesList = files
      .map(file => `            <li><a href="${folder}/${file}">${file}</a></li>`)
      .join('\n');
    
    foldersHTML += `    <div class="folder">
        <h2>📁 ${folder}</h2>
        <ul>
${filesList}
        </ul>
    </div>
    
`;
  });
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Files for Agents</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 0.5rem;
        }
        .folder {
            margin: 2rem 0;
            padding: 1rem;
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            border-radius: 4px;
        }
        .folder h2 {
            margin-top: 0;
            color: #2c3e50;
        }
        ul {
            list-style: none;
            padding: 0;
        }
        li {
            margin: 0.5rem 0;
        }
        a {
            color: #3498db;
            text-decoration: none;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            display: inline-block;
            transition: background 0.2s;
        }
        a:hover {
            background: #e3f2fd;
            text-decoration: underline;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <h1>Files for Agents</h1>
    <p>This directory contains prompts and files designed to be discoverable and readable by AI agents.</p>
    
${foldersHTML}    <div class="meta">
        <p><strong>For agents:</strong> All files in this directory are publicly accessible. You can read any markdown file directly by following the links above or accessing the raw file URLs.</p>
        <p><strong>Last updated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;

  return html;
}

// Write the generated HTML to index.html
try {
  const html = generateHTML();
  fs.writeFileSync(INDEX_FILE, html, 'utf8');
  console.log('✅ index.html generated successfully!');
  console.log(`   Found ${getFolders().length} folder(s)`);
} catch (err) {
  console.error('❌ Error generating index.html:', err.message);
  process.exit(1);
}
