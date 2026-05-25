/**
 * Validation script for quiz question data integrity.
 * Checks all 160 questions for correct structure and data consistency.
 *
 * Validates: Requirements 6.3, Property 16
 */

const fs = require('fs');
const path = require('path');

// Load questions.js by evaluating it (it declares a const QUESTIONS)
const fileContent = fs.readFileSync(path.join(__dirname, 'questions.js'), 'utf8');
const QUESTIONS = eval(fileContent + '; QUESTIONS;');

let errors = [];
let warnings = [];

function addError(questionId, message) {
  errors.push(`[ERROR] Question ${questionId}: ${message}`);
}

function addWarning(questionId, message) {
  warnings.push(`[WARN] Question ${questionId}: ${message}`);
}

// 1. Exactly 160 questions exist
console.log('=== Question Data Integrity Validation ===\n');
console.log(`Total questions found: ${QUESTIONS.length}`);
if (QUESTIONS.length !== 160) {
  errors.push(`[ERROR] Expected exactly 160 questions, found ${QUESTIONS.length}`);
}

// 2. IDs are sequential 1-160 with no gaps
const ids = QUESTIONS.map(q => q.id);
const expectedIds = Array.from({ length: 160 }, (_, i) => i + 1);
const missingIds = expectedIds.filter(id => !ids.includes(id));
const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);

if (missingIds.length > 0) {
  errors.push(`[ERROR] Missing IDs: ${missingIds.join(', ')}`);
}
if (duplicateIds.length > 0) {
  errors.push(`[ERROR] Duplicate IDs: ${duplicateIds.join(', ')}`);
}

// Validate each question
QUESTIONS.forEach((q, index) => {
  const qId = q.id || `index-${index}`;

  // 3. Each question has required fields with correct types
  if (typeof q.id !== 'number') {
    addError(qId, `id should be a number, got ${typeof q.id}`);
  }

  if (typeof q.text !== 'string' || q.text.trim().length === 0) {
    addError(qId, 'text should be a non-empty string');
  }

  if (!Array.isArray(q.options)) {
    addError(qId, 'options should be an array');
    return; // Skip further checks for this question
  }

  if (q.options.length < 2 || q.options.length > 5) {
    addError(qId, `options should have 2-5 items, found ${q.options.length}`);
  }

  if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
    addError(qId, 'correctAnswers should be a non-empty array');
  }

  if (typeof q.requiredSelections !== 'number') {
    addError(qId, `requiredSelections should be a number, got ${typeof q.requiredSelections}`);
  }

  // 4. Each option has key (string) and text (non-empty string)
  q.options.forEach((opt, optIdx) => {
    if (typeof opt.key !== 'string' || opt.key.trim().length === 0) {
      addError(qId, `option[${optIdx}] key should be a non-empty string`);
    }
    if (typeof opt.text !== 'string' || opt.text.trim().length === 0) {
      addError(qId, `option[${optIdx}] text should be a non-empty string`);
    }
  });

  // 5. Option keys are unique within each question
  const optionKeys = q.options.map(o => o.key);
  const uniqueKeys = new Set(optionKeys);
  if (uniqueKeys.size !== optionKeys.length) {
    const dupes = optionKeys.filter((k, i) => optionKeys.indexOf(k) !== i);
    addError(qId, `duplicate option keys: ${dupes.join(', ')}`);
  }

  // 6. All correctAnswers keys exist in the question's options
  if (Array.isArray(q.correctAnswers)) {
    q.correctAnswers.forEach(ansKey => {
      if (!optionKeys.includes(ansKey)) {
        addError(qId, `correctAnswer key "${ansKey}" not found in options [${optionKeys.join(', ')}]`);
      }
    });
  }

  // 7. requiredSelections equals correctAnswers.length
  if (Array.isArray(q.correctAnswers) && typeof q.requiredSelections === 'number') {
    if (q.requiredSelections !== q.correctAnswers.length) {
      addError(qId, `requiredSelections (${q.requiredSelections}) !== correctAnswers.length (${q.correctAnswers.length})`);
    }
  }
});

// Print results
console.log('\n--- Results ---');
if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ All validations passed! Question data is intact.');
  console.log(`   - 160 questions present with sequential IDs`);
  console.log(`   - All questions have correct structure`);
  console.log(`   - All correctAnswers reference valid option keys`);
  console.log(`   - requiredSelections matches correctAnswers.length for all questions`);
} else {
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`);
    warnings.forEach(w => console.log(`   ${w}`));
  }
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   ${e}`));
    process.exit(1);
  }
}
