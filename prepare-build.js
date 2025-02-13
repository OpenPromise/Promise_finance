const fs = require('fs');
const path = require('path');

// 确保目标目录存在
const mdiDir = path.join(__dirname, 'assets', 'mdi');
fs.mkdirSync(path.join(mdiDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(mdiDir, 'fonts'), { recursive: true });

// 复制文件
const mdiNodeModules = path.join(__dirname, 'node_modules', '@mdi', 'font');
fs.copyFileSync(
    path.join(mdiNodeModules, 'css', 'materialdesignicons.min.css'),
    path.join(mdiDir, 'css', 'materialdesignicons.min.css')
);

const fontFiles = ['woff', 'woff2'].map(ext => `materialdesignicons-webfont.${ext}`);
fontFiles.forEach(file => {
    fs.copyFileSync(
        path.join(mdiNodeModules, 'fonts', file),
        path.join(mdiDir, 'fonts', file)
    );
}); 