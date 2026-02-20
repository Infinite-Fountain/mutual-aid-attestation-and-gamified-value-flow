#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const FILES_FOR_AGENTS_DIR = __dirname;
const INDEX_FILE = path.join(FILES_FOR_AGENTS_DIR, 'index.html');

// Build a tree of folders and .md files (recursive: includes subfolders)
function buildTree(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const node = { files: [], children: {} };

  const dirs = items
    .filter(i => i.isDirectory() && !i.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = items
    .filter(i => i.isFile() && i.name.endsWith('.md'))
    .map(i => i.name)
    .sort();

  node.files = files;

  for (const d of dirs) {
    const fullPath = path.join(dir, d.name);
    node.children[d.name] = buildTree(fullPath);
  }

  return node;
}

// Get root tree (only top-level folders under files-for-agents)
function getRootTree() {
  const items = fs.readdirSync(FILES_FOR_AGENTS_DIR, { withFileTypes: true });
  const root = { files: [], children: {} };

  const dirs = items
    .filter(i => i.isDirectory() && !i.name.startsWith('.') && i.name !== 'node_modules')
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const d of dirs) {
    const folderPath = path.join(FILES_FOR_AGENTS_DIR, d.name);
    root.children[d.name] = buildTree(folderPath);
  }

  return root;
}

// Count total folders in tree (for logging)
function countFolders(node) {
  let n = Object.keys(node.children).length;
  for (const child of Object.values(node.children)) {
    n += countFolders(child);
  }
  return n;
}

// Render one level of the tree as nested <details> (pathPrefix = relative path from files-for-agents)
function renderNode(node, pathPrefix) {
  const entries = Object.entries(node.children).sort((a, b) => a[0].localeCompare(b[0]));
  let html = '';

  for (const [name, child] of entries) {
    const prefix = pathPrefix ? pathPrefix + '/' + name : name;
    const hasFiles = child.files.length > 0;
    const hasChildren = Object.keys(child.children).length > 0;
    if (!hasFiles && !hasChildren) continue;

    const filesList = child.files
      .map(f => `            <li><a href="${prefix}/${f}">${f}</a></li>`)
      .join('\n');
    const filesBlock = hasFiles
      ? `        <ul>\n${filesList}\n        </ul>\n`
      : '';
    const nested = renderNode(child, prefix);
    const nestedBlock = nested ? `        <div class="nested">\n${nested}        </div>\n` : '';

    html += `    <details class="folder" data-path="${prefix.replace(/"/g, '&quot;')}">
        <summary><h2>📁 ${name}</h2></summary>
${filesBlock}${nestedBlock}    </details>

`;
  }

  return html;
}

// Generate HTML
function generateHTML() {
  const root = getRootTree();
  const foldersHTML = renderNode(root, '');
  
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
        .breadcrumb {
            font-size: 1.1rem;
            color: #2c3e50;
            padding: 0.75rem 1rem;
            background: #e8f4fc;
            border-left: 4px solid #3498db;
            border-radius: 4px;
            margin-bottom: 1.5rem;
            font-family: ui-monospace, monospace;
            word-break: break-all;
        }
        .breadcrumb .sep {
            color: #3498db;
            margin: 0 0.35rem;
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
        .folder summary {
            cursor: pointer;
            list-style: none;
        }
        .folder summary::-webkit-details-marker {
            display: none;
        }
        .folder summary::before {
            content: "▶ ";
            font-size: 0.75em;
            color: #3498db;
        }
        .folder[open] summary::before {
            content: "▼ ";
        }
        .folder .nested {
            margin-left: 1rem;
            margin-top: 0.5rem;
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
    <div id="breadcrumb" class="breadcrumb">files-for-agents</div>
    
${foldersHTML}    <div class="meta">
        <p><strong>For agents:</strong> All files in this directory are publicly accessible. You can read any markdown file directly by following the links above or accessing the raw file URLs.</p>
        <p><strong>Last updated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <script>
        function updateBreadcrumb() {
            var open = document.querySelectorAll('details.folder[open]');
            var deepest = null;
            var maxLen = -1;
            for (var i = 0; i < open.length; i++) {
                var p = (open[i].getAttribute('data-path') || '').length;
                if (p > maxLen) { maxLen = p; deepest = open[i]; }
            }
            var el = document.getElementById('breadcrumb');
            if (!deepest) {
                el.textContent = 'files-for-agents';
                return;
            }
            var path = deepest.getAttribute('data-path') || '';
            var parts = path.split('/');
            var escape = function(s) {
                var d = document.createElement('span');
                d.textContent = s;
                return d.innerHTML;
            };
            var html = 'files-for-agents';
            for (var j = 0; j < parts.length; j++) {
                html += '<span class="sep">/</span>' + escape(parts[j]);
            }
            el.innerHTML = html;
        }
        document.querySelectorAll('details.folder').forEach(function(d) {
            d.addEventListener('toggle', updateBreadcrumb);
        });
    </script>
</body>
</html>`;

  return html;
}

// Write the generated HTML to index.html
try {
  const html = generateHTML();
  fs.writeFileSync(INDEX_FILE, html, 'utf8');
  console.log('✅ index.html generated successfully!');
  console.log(`   Found ${countFolders(getRootTree())} folder(s) (including nested)`);
} catch (err) {
  console.error('❌ Error generating index.html:', err.message);
  process.exit(1);
}
