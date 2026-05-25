#!/usr/bin/env node
'use strict';

/**
 * Build script: inlines questions.js into index.html to produce a single-file quiz.
 * Output: quiz-app/dist/index.html
 */

const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(srcDir, 'dist');

// Read source files
const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const questionsSet2Js = fs.readFileSync(path.join(srcDir, 'questions-set2.js'), 'utf8');
const questionsJs = fs.readFileSync(path.join(srcDir, 'questions.js'), 'utf8');

// Replace the external script tags with inline scripts containing the questions
let inlined = html.replace(
  '<script src="questions-set2.js"></script>',
  '<script>\n' + questionsSet2Js + '\n</script>'
);
inlined = inlined.replace(
  '<script src="questions.js"></script>',
  '<script>\n' + questionsJs + '\n</script>'
);

// Write output
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
fs.writeFileSync(path.join(distDir, 'index.html'), inlined, 'utf8');

console.log('✅ Built single-file quiz: dist/index.html');
console.log('   Size: ' + Math.round(Buffer.byteLength(inlined) / 1024) + ' KB');
