const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirs = [
  path.join(__dirname, '..', 'docs', 'js'),
  path.join(__dirname, '..', 'tests')
];

let failed = 0;
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    if (f.endsWith('.js')) {
      const fullPath = path.join(dir, f);
      try {
        execSync(`node --check "${fullPath}"`, { stdio: 'inherit' });
        console.log(`✓ Syntax OK: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
      } catch (err) {
        console.error(`✗ Syntax Error: ${fullPath}`);
        failed++;
      }
    }
  });
});

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All JavaScript files passed syntax verification!');
}
