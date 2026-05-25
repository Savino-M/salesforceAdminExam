'use strict';

const { createQuizEngine } = require('./quiz-engine');

// Minimal test questions for verification
const TEST_QUESTIONS = [
  {
    id: 1,
    text: "Question 1",
    options: [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" },
      { key: "C", text: "Option C" },
      { key: "D", text: "Option D" }
    ],
    correctAnswers: ["B"],
    requiredSelections: 1
  },
  {
    id: 2,
    text: "Question 2 (multi)",
    options: [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" },
      { key: "C", text: "Option C" },
      { key: "D", text: "Option D" }
    ],
    correctAnswers: ["A", "C"],
    requiredSelections: 2
  },
  {
    id: 3,
    text: "Question 3",
    options: [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" }
    ],
    correctAnswers: ["A"],
    requiredSelections: 1
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error('FAIL: ' + message);
  }
}

function runTests() {
  var passed = 0;
  var failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failed++;
      console.log('  ✗ ' + name + ' — ' + e.message);
    }
  }

  console.log('Quiz Engine Tests\n');

  // Task 2.1: init()
  test('init() creates default state', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    var state = engine.init();
    assert(state.currentIndex === 0, 'currentIndex should be 0');
    assert(Object.keys(state.answers).length === 0, 'answers should be empty');
    assert(state.score === 0, 'score should be 0');
    assert(state.totalAnswered === 0, 'totalAnswered should be 0');
    assert(typeof state.startedAt === 'string', 'startedAt should be a string');
    assert(state.version === 1, 'version should be 1');
  });

  // Task 2.2: submitAnswer()
  test('submitAnswer() correct single answer', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    var result = engine.submitAnswer(["B"]);
    assert(result.correct === true, 'should be correct');
    assert(engine.getState().score === 1, 'score should be 1');
    assert(engine.getState().totalAnswered === 1, 'totalAnswered should be 1');
  });

  test('submitAnswer() incorrect single answer', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    var result = engine.submitAnswer(["A"]);
    assert(result.correct === false, 'should be incorrect');
    assert(engine.getState().score === 0, 'score should remain 0');
    assert(engine.getState().totalAnswered === 1, 'totalAnswered should be 1');
  });

  test('submitAnswer() rejects wrong selection count for multi-answer', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.nextQuestion(); // go to question 2 (multi)
    var result = engine.submitAnswer(["A"]); // only 1, needs 2
    assert(result === null, 'should reject with wrong count');
    assert(engine.getState().totalAnswered === 0, 'totalAnswered should remain 0');
  });

  test('submitAnswer() correct multi-answer (order-independent)', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.nextQuestion(); // go to question 2
    var result = engine.submitAnswer(["C", "A"]); // reversed order
    assert(result.correct === true, 'should be correct regardless of order');
    assert(engine.getState().score === 1, 'score should be 1');
  });

  test('submitAnswer() locks after submission (Property 7)', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["A"]); // wrong answer
    var result2 = engine.submitAnswer(["B"]); // try to re-submit
    assert(result2 === null, 'should reject re-submission');
    assert(engine.getState().score === 0, 'score should not change');
    assert(engine.getState().totalAnswered === 1, 'totalAnswered should not change');
  });

  // Task 2.3: nextQuestion() and prevQuestion()
  test('nextQuestion() advances index by 1', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.nextQuestion();
    assert(engine.getState().currentIndex === 1, 'should be 1');
  });

  test('nextQuestion() does not exceed bounds', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.nextQuestion();
    engine.nextQuestion();
    engine.nextQuestion(); // at index 2 (last), try to go further
    assert(engine.getState().currentIndex === 2, 'should stay at 2');
  });

  test('prevQuestion() decreases index by 1', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.nextQuestion();
    engine.prevQuestion();
    assert(engine.getState().currentIndex === 0, 'should be 0');
  });

  test('prevQuestion() does not go below 0', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.prevQuestion();
    assert(engine.getState().currentIndex === 0, 'should stay at 0');
  });

  // Task 2.4: reset()
  test('reset() clears all state to defaults (Property 15)', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["B"]);
    engine.nextQuestion();
    var state = engine.reset();
    assert(state.currentIndex === 0, 'currentIndex should be 0');
    assert(Object.keys(state.answers).length === 0, 'answers should be empty');
    assert(state.score === 0, 'score should be 0');
    assert(state.totalAnswered === 0, 'totalAnswered should be 0');
  });

  // Task 2.5: getAnswer()
  test('getAnswer() returns null for unanswered question', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    assert(engine.getAnswer(1) === null, 'should be null');
  });

  test('getAnswer() returns recorded answer', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["B"]);
    var answer = engine.getAnswer(1);
    assert(answer !== null, 'should not be null');
    assert(answer.selected[0] === "B", 'selected should be B');
    assert(answer.correct === true, 'should be correct');
  });

  // Task 2.6: isComplete() and getProgress()
  test('isComplete() returns false when not all answered', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["B"]);
    assert(engine.isComplete() === false, 'should not be complete');
  });

  test('isComplete() returns true when all answered', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["B"]); // q1
    engine.nextQuestion();
    engine.submitAnswer(["A", "C"]); // q2
    engine.nextQuestion();
    engine.submitAnswer(["A"]); // q3
    assert(engine.isComplete() === true, 'should be complete');
  });

  test('getProgress() returns correct values', function() {
    var engine = createQuizEngine(TEST_QUESTIONS);
    engine.init();
    engine.submitAnswer(["B"]);
    engine.nextQuestion();
    var progress = engine.getProgress();
    assert(progress.current === 2, 'current should be 2');
    assert(progress.total === 3, 'total should be 3');
    assert(progress.score === 1, 'score should be 1');
    assert(progress.totalAnswered === 1, 'totalAnswered should be 1');
  });

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
