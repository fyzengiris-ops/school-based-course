/**
 * CloudBase 部署命令使用 ./dist；本仓库无前端打包，直接把 prototype 拷到 dist。
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "prototype");
const dest = path.join(root, "dist");

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(fromPath, toPath);
    else fs.copyFileSync(fromPath, toPath);
  }
}

if (!fs.existsSync(src)) {
  console.error(`[build] missing source dir: ${src}`);
  process.exit(1);
}

rmDir(dest);
copyDir(src, dest);

const courseware = path.join(dest, "assets", "courseware");
const files = fs.existsSync(courseware) ? fs.readdirSync(courseware) : [];
console.log(`[build] copied prototype -> dist (${files.length} courseware files)`);
files.forEach((name) => console.log(`  - assets/courseware/${name}`));
