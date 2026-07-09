const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

walk('./src', function(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let insideComponent = false;
    let foundReturn = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Very basic heuristic for component start
        if (line.match(/const [A-Z]\w+ = \(/) || line.match(/function [A-Z]\w+\(/)) {
            insideComponent = true;
            foundReturn = false;
        }
        
        if (insideComponent) {
            // If we hit an early return
            if (line.startsWith('if (') && line.includes('return')) {
                foundReturn = true;
            }
            if (line.startsWith('return ')) {
                // If this is a top-level return, it might be the end of the component
                // but let's assume it sets foundReturn
                foundReturn = true;
            }
            
            // If we find a hook AFTER an early return
            if (foundReturn && line.match(/const .* = use[A-Z]\w*\(/)) {
                console.log(`Potential Hook Violation in ${filePath}:${i+1} -> ${line}`);
            }
            
            // reset on closing brace (rough heuristic)
            if (line === '};' || line === '}') {
                insideComponent = false;
                foundReturn = false;
            }
        }
    }
});
