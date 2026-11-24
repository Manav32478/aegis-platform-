const fs = require('fs');
const path = require('path');

test.each(['deploy.yml', 'security-scan.yml'])('%s uses the existing Trivy action tag', file => {
  const contents = fs.readFileSync(path.join(__dirname, '../.github/workflows', file), 'utf8');
  expect(contents).toContain('aquasecurity/trivy-action@v0.24.0');
  expect(contents).not.toContain('aquasecurity/trivy-action@0.24.0');
});
