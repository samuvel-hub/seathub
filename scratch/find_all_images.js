const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Search git log for any image file additions or references
try {
  const gitLog = execSync('git log --stat -n 50', { cwd: 'c:\\Users\\samuv\\.gemini\\antigravity\\scratch\\seathub-seating-management' }).toString();
  const imgLines = gitLog.split('\n').filter(l => /\.(png|jpg|jpeg|svg|webp|gif)/i.test(l));
  console.log('--- Git log images ---');
  console.log(imgLines.slice(0, 30).join('\n'));
} catch (e) {
  console.error('Git error:', e.message);
}

// 2. Search brain folders for image files or generate_image tool calls
const brainDir = 'C:\\Users\\samuv\\.gemini\\antigravity-ide\\brain';
const convDirs = fs.readdirSync(brainDir);
console.log('--- Checking brain dirs ---');
for (const dir of convDirs) {
  const full = path.join(brainDir, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  
  // check for files inside
  const findFiles = (d, depth = 0) => {
    if (depth > 3) return [];
    let res = [];
    try {
      const items = fs.readdirSync(d);
      for (const item of items) {
        const itemPath = path.join(d, item);
        const st = fs.statSync(itemPath);
        if (st.isDirectory()) {
          res = res.concat(findFiles(itemPath, depth + 1));
        } else if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(item)) {
          res.push(itemPath);
        }
      }
    } catch (e) {}
    return res;
  };
  
  const imgs = findFiles(full);
  if (imgs.length > 0) {
    console.log(`In ${dir}:`, imgs);
  }
}
