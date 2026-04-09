const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const markdownFiles = [
  '.github/SECURITY.md',    
  // Add other markdown files that need version updates
];

const workerDirs = [
  'workers/audit-worker',
  'workers/data-worker',
  'workers/image-worker',
  'workers/pdf-worker',
  'workers/user-worker',
];

function updateMarkdownVersions() {
  console.log(`📝 Updating markdown files with version ${packageJson.version}...`);
  
  markdownFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${filePath} (file not found)`);
      return;
    }
    
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace version placeholders
      content = content.replace(/{{VERSION}}/g, packageJson.version);
      content = content.replace(/v\d+\.\d+\.\d+(-\w+)?/g, `v${packageJson.version}`);
      
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated ${filePath}`);
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  });

  console.log(`📦 Updating worker package.json files with version ${packageJson.version}...`);

  workerDirs.forEach(workerDir => {
    const fullPath = path.join(__dirname, '..', workerDir, 'package.json');

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${workerDir}/package.json (file not found)`);
      return;
    }

    try {
      const workerPkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      workerPkg.version = packageJson.version;
      fs.writeFileSync(fullPath, JSON.stringify(workerPkg, null, 2) + '\n');
      console.log(`✅ Updated ${workerDir}/package.json`);
    } catch (error) {
      console.error(`❌ Error updating ${workerDir}/package.json:`, error.message);
    }
  });
  
  console.log('🎉 Version update complete!');
}

// Run if called directly
if (require.main === module) {
  updateMarkdownVersions();
}

module.exports = { updateMarkdownVersions };
