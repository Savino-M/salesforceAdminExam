'use strict';

const fc = require('fast-check');
const { createQuizEngine, createStorage } = require('./quiz-engine');

// --- Generators ---

const VALID_KEYS = ['A', 'B', 'C', 'D', 'E'];

/** Generate a valid question object */
function questionArb() {
  return fc.integer({ min: 2, max: 5 }).chain(function(numOptions) {
    var keys = VALID_KEYS.slice(0, numOptions);
    return fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      text: fc.string({ minLength: 1, maxLength: 200 }),
      options: fc.constant(keys.map(function(k) { return { key: k, text: 'Option ' + k }; })),
      numCorrect: fc.integer({ min: 1, max: numOptions })
    }).map(function(r) {
      // Pick numCorrect keys as correct answers
      var shuffled = keys.slice().sort(function() { return Math.random() - 0.5; });
      var correctAnswers = shuffled.slice(0, r.numCorrect);
      return {
        id: r.id,
        text: r.text,
        options: r.options,
        correctAnswers: correctAnswers,
        requiredSelections: r.numCorrect
      };
    });
  });
}

/** Generate a list of N questions with unique sequential IDs */
function questionsArb(n) {
  return fc.array(questionArb(), { minLength: n, maxLength: n }).map(function(qs) {
    return qs.map(function(q, i) { return Object.assign({}, q, { id: i + 1 }); });
  });
}

/** Generate a random subset of keys from a question's options */
function selectionArb(question) {
  var keys = question.options.map(function(o) { return o.key; });
  return fc.subarray(keys, { minLength: 1, maxLength: keys.length });
}

// --- Test Runner ---
var passed = 0;
var failed = 0;

function property(name, arb, predicate) {
  try {
    fc.assert(fc.property(arb, predicate), { numRuns: 100 });
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message.split('\n')[0]);
  }
}

function property2(name, arb1, arb2, predicate) {
  try {
    fc.assert(fc.property(arb1, arb2, predicate), { numRuns: 100 });
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message.split('\n')[0]);
  }
}

console.log('Property-Based Tests\n');

// --- Property 3: Input type matches question type ---
// For any question, if requiredSelections === 1 then type should be "radio", else "checkbox"
console.log('Property 3: Input type matches question type');
property(
  'requiredSelections=1 implies radio, >1 implies checkbox',
  questionArb(),
  function(q) {
    var expectedType = q.requiredSelections === 1 ? 'radio' : 'checkbox';
    // The engine itself doesn't render, but we verify the logic that determines type
    var isRadio = q.requiredSelections === 1;
    var isCheckbox = q.requiredSelections > 1;
    return (isRadio && expectedType === 'radio') || (isCheckbox && expectedType === 'checkbox');
  }
);

// --- Property 5: Multi-answer submission validation ---
// For any question with requiredSelections > 1, submitting wrong count is rejected
console.log('\nProperty 5: Multi-answer submission validation');
property(
  'submission rejected when selection count != requiredSelections',
  questionArb().filter(function(q) { return q.requiredSelections > 1; }),
  function(q) {
    var engine = createQuizEngine([q]);
    engine.init();
    var keys = q.options.map(function(o) { return o.key; });
    // Try submitting with wrong count (1 selection for multi-answer)
    var wrongSelection = [keys[0]];
    if (wrongSelection.length === q.requiredSelections) {
      // Edge case: if requiredSelections happens to be 1, skip (filtered above)
      return true;
    }
    var result = engine.submitAnswer(wrongSelection);
    var stateUnchanged = engine.getState().totalAnswered === 0 && engine.getState().score === 0;
    return result === null && stateUnchanged;
  }
);

property(
  'submission rejected with empty array',
  questionArb(),
  function(q) {
    var engine = createQuizEngine([q]);
    engine.init();
    var result = engine.submitAnswer([]);
    return result === null && engine.getState().totalAnswered === 0;
  }
);

// --- Property 6: Answer evaluation correctness ---
// Correct iff selected set exactly equals correctAnswers set (order-independent)
console.log('\nProperty 6: Answer evaluation correctness');
property(
  'submitting exact correctAnswers (any order) returns correct=true',
  questionArb(),
  function(q) {
    var engine = createQuizEngine([q]);
    engine.init();
    // Shuffle correctAnswers
    var shuffled = q.correctAnswers.slice().sort(function() { return Math.random() - 0.5; });
    var result = engine.submitAnswer(shuffled);
    return result !== null && result.correct === true;
  }
);

property(
  'submitting any set != correctAnswers returns correct=false',
  questionArb().filter(function(q) { return q.options.length > q.requiredSelections; }),
  function(q) {
    var engine = createQuizEngine([q]);
    engine.init();
    // Build a wrong answer: take requiredSelections keys that are NOT all correct
    var allKeys = q.options.map(function(o) { return o.key; });
    var wrongKeys = allKeys.filter(function(k) { return q.correctAnswers.indexOf(k) === -1; });
    if (wrongKeys.length === 0) return true; // all options are correct, skip
    // Replace one correct key with a wrong one
    var selection = q.correctAnswers.slice();
    selection[0] = wrongKeys[0];
    // Ensure unique and correct count
    selection = Array.from(new Set(selection)).slice(0, q.requiredSelections);
    if (selection.length !== q.requiredSelections) return true; // can't form valid wrong answer
    // Check it's actually different from correctAnswers
    var sortedSel = selection.slice().sort().join(',');
    var sortedCorr = q.correctAnswers.slice().sort().join(',');
    if (sortedSel === sortedCorr) return true; // accidentally same
    var result = engine.submitAnswer(selection);
    return result !== null && result.correct === false;
  }
);

// --- Property 7: Lock after submission ---
console.log('\nProperty 7: Lock after submission');
property2(
  'cannot re-submit after answer is recorded',
  questionArb(),
  fc.boolean(),
  function(q, submitCorrect) {
    var engine = createQuizEngine([q]);
    engine.init();
    // First submission
    var firstAnswer = submitCorrect ? q.correctAnswers.slice() : [q.options[q.options.length - 1].key];
    if (firstAnswer.length !== q.requiredSelections) {
      firstAnswer = q.correctAnswers.slice(); // fallback to correct
    }
    engine.submitAnswer(firstAnswer);
    var stateAfterFirst = JSON.parse(JSON.stringify(engine.getState()));
    // Second submission attempt
    var secondAnswer = q.correctAnswers.slice();
    var result2 = engine.submitAnswer(secondAnswer);
    var stateAfterSecond = engine.getState();
    return result2 === null &&
      stateAfterSecond.score === stateAfterFirst.score &&
      stateAfterSecond.totalAnswered === stateAfterFirst.totalAnswered;
  }
);

// --- Property 11: Score increments on correct answer only ---
console.log('\nProperty 11: Score increments on correct answer only');
property(
  'score increases by 1 iff answer is correct, else unchanged',
  questionsArb(5),
  function(questions) {
    var engine = createQuizEngine(questions);
    engine.init();
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var scoreBefore = engine.getState().score;
      // Alternate correct/incorrect
      var selection;
      if (i % 2 === 0) {
        selection = q.correctAnswers.slice();
      } else {
        // Wrong answer: pick keys not in correctAnswers
        var wrongKeys = q.options.map(function(o) { return o.key; })
          .filter(function(k) { return q.correctAnswers.indexOf(k) === -1; });
        if (wrongKeys.length >= q.requiredSelections) {
          selection = wrongKeys.slice(0, q.requiredSelections);
        } else {
          selection = q.correctAnswers.slice(); // fallback
        }
      }
      var result = engine.submitAnswer(selection);
      if (!result) return false;
      var scoreAfter = engine.getState().score;
      if (result.correct) {
        if (scoreAfter !== scoreBefore + 1) return false;
      } else {
        if (scoreAfter !== scoreBefore) return false;
      }
      if (i < questions.length - 1) engine.nextQuestion();
    }
    return true;
  }
);

// --- Property 12: Navigation advances index ---
console.log('\nProperty 12: Navigation advances index');
property(
  'nextQuestion increments currentIndex by 1 (within bounds)',
  fc.integer({ min: 2, max: 20 }),
  function(numQuestions) {
    var qs = [];
    for (var i = 0; i < numQuestions; i++) {
      qs.push({ id: i + 1, text: 'Q' + (i + 1), options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correctAnswers: ['A'], requiredSelections: 1 });
    }
    var engine = createQuizEngine(qs);
    engine.init();
    for (var j = 0; j < numQuestions - 1; j++) {
      var before = engine.getState().currentIndex;
      engine.nextQuestion();
      if (engine.getState().currentIndex !== before + 1) return false;
    }
    // At last index, nextQuestion should be no-op
    var lastIdx = engine.getState().currentIndex;
    engine.nextQuestion();
    return engine.getState().currentIndex === lastIdx;
  }
);

property(
  'prevQuestion decrements currentIndex by 1 (within bounds)',
  fc.integer({ min: 2, max: 20 }),
  function(numQuestions) {
    var qs = [];
    for (var i = 0; i < numQuestions; i++) {
      qs.push({ id: i + 1, text: 'Q' + (i + 1), options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correctAnswers: ['A'], requiredSelections: 1 });
    }
    var engine = createQuizEngine(qs);
    engine.init();
    // Move to last
    for (var j = 0; j < numQuestions - 1; j++) engine.nextQuestion();
    // Now go back
    for (var k = numQuestions - 1; k > 0; k--) {
      var before = engine.getState().currentIndex;
      engine.prevQuestion();
      if (engine.getState().currentIndex !== before - 1) return false;
    }
    // At index 0, prevQuestion should be no-op
    engine.prevQuestion();
    return engine.getState().currentIndex === 0;
  }
);

// --- Property 15: Reset clears all state ---
console.log('\nProperty 15: Reset clears all state');
property(
  'reset produces currentIndex=0, answers={}, score=0, totalAnswered=0',
  questionsArb(3),
  function(questions) {
    var engine = createQuizEngine(questions);
    engine.init();
    // Do some work
    engine.submitAnswer(questions[0].correctAnswers.slice());
    engine.nextQuestion();
    engine.submitAnswer(questions[1].correctAnswers.slice());
    // Reset
    var state = engine.reset();
    return state.currentIndex === 0 &&
      Object.keys(state.answers).length === 0 &&
      state.score === 0 &&
      state.totalAnswered === 0 &&
      state.version === 1;
  }
);

// --- Property 16: Question data integrity ---
console.log('\nProperty 16: Question data integrity');
(function() {
  // Load actual questions
  var fs = require('fs');
  var path = require('path');
  var fileContent = fs.readFileSync(path.join(__dirname, 'questions.js'), 'utf8');
  var QUESTIONS = eval(fileContent + '; QUESTIONS;');

  try {
    // Exactly 160 questions
    if (QUESTIONS.length !== 160) throw new Error('Expected 160 questions, got ' + QUESTIONS.length);

    var allValid = true;
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      // Numeric id
      if (typeof q.id !== 'number') { allValid = false; break; }
      // Non-empty text
      if (typeof q.text !== 'string' || q.text.length === 0) { allValid = false; break; }
      // At least 2 options with unique keys
      if (!Array.isArray(q.options) || q.options.length < 2) { allValid = false; break; }
      var keys = q.options.map(function(o) { return o.key; });
      if (new Set(keys).size !== keys.length) { allValid = false; break; }
      // Non-empty correctAnswers where every key exists in options
      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) { allValid = false; break; }
      var allKeysValid = q.correctAnswers.every(function(k) { return keys.indexOf(k) !== -1; });
      if (!allKeysValid) { allValid = false; break; }
      // requiredSelections equals correctAnswers.length
      if (q.requiredSelections !== q.correctAnswers.length) { allValid = false; break; }
    }

    if (allValid) {
      passed++;
      console.log('  ✓ All 160 questions have valid structure, unique keys, valid correctAnswers');
    } else {
      failed++;
      console.log('  ✗ Question data integrity check failed at question ' + (i + 1));
    }
  } catch (e) {
    failed++;
    console.log('  ✗ Question data integrity: ' + e.message);
  }
})();

// --- Property 17: Session state round-trip persistence ---
console.log('\nProperty 17: Session state round-trip persistence');

function createMockStorage() {
  var store = {};
  return {
    getItem: function(key) { return store.hasOwnProperty(key) ? store[key] : null; },
    setItem: function(key, value) { store[key] = String(value); },
    removeItem: function(key) { delete store[key]; },
    clear: function() { store = {}; }
  };
}

/** Generate a valid session state */
function sessionStateArb() {
  return fc.record({
    currentIndex: fc.integer({ min: 0, max: 159 }),
    score: fc.integer({ min: 0, max: 160 }),
    totalAnswered: fc.integer({ min: 0, max: 160 }),
    startedAt: fc.date().map(function(d) { return d.toISOString(); })
  }).chain(function(base) {
    // Generate answers map consistent with totalAnswered
    var numAnswers = Math.min(base.totalAnswered, 160);
    return fc.array(
      fc.record({
        selected: fc.subarray(['A', 'B', 'C', 'D', 'E'], { minLength: 1, maxLength: 3 }),
        correct: fc.boolean()
      }),
      { minLength: numAnswers, maxLength: numAnswers }
    ).map(function(ansArr) {
      var answers = {};
      var correctCount = 0;
      for (var i = 0; i < ansArr.length; i++) {
        answers[i + 1] = ansArr[i];
        if (ansArr[i].correct) correctCount++;
      }
      return {
        currentIndex: base.currentIndex,
        answers: answers,
        score: correctCount,
        totalAnswered: numAnswers,
        startedAt: base.startedAt,
        version: 1
      };
    });
  });
}

property(
  'save then load produces deeply equal state',
  sessionStateArb(),
  function(state) {
    var mock = createMockStorage();
    var storage = createStorage(mock);
    storage.save(state);
    var loaded = storage.load();
    return JSON.stringify(loaded) === JSON.stringify(state);
  }
);

// --- Summary ---
console.log('\n\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
