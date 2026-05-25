'use strict';

/**
 * Quiz Engine — pure logic module (no DOM, no localStorage)
 * Can be used standalone in Node.js for testing or inlined into index.html.
 */

function createQuizEngine(questions) {
  var state;

  function createDefaultState() {
    return {
      currentIndex: 0,
      answers: {},
      score: 0,
      totalAnswered: 0,
      startedAt: new Date().toISOString(),
      version: 1
    };
  }

  function init() {
    state = createDefaultState();
    return state;
  }

  function getState() {
    return state;
  }

  function setState(newState) {
    state = newState;
  }

  function getCurrentQuestion() {
    return questions[state.currentIndex] || null;
  }

  function submitAnswer(selectedKeys) {
    var question = questions[state.currentIndex];
    if (!question) {
      return null;
    }

    // Lock after submission — cannot re-submit for already-answered question
    if (state.answers[question.id]) {
      return null;
    }

    // Multi-answer submission validation — reject if selection count != requiredSelections
    if (!Array.isArray(selectedKeys) || selectedKeys.length !== question.requiredSelections) {
      return null;
    }

    // Answer evaluation — correct iff selected set exactly equals correctAnswers set (order-independent)
    var sortedSelected = selectedKeys.slice().sort();
    var sortedCorrect = question.correctAnswers.slice().sort();
    var correct = sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every(function(key, i) { return key === sortedCorrect[i]; });

    // Record the answer
    state.answers[question.id] = {
      selected: selectedKeys,
      correct: correct
    };

    // Update score and totalAnswered
    state.totalAnswered += 1;
    if (correct) {
      state.score += 1;
    }

    return { correct: correct, correctAnswers: question.correctAnswers, selected: selectedKeys };
  }

  function nextQuestion() {
    if (state.currentIndex < questions.length - 1) {
      state.currentIndex += 1;
    }
  }

  function prevQuestion() {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
    }
  }

  function reset() {
    state = createDefaultState();
    return state;
  }

  function getAnswer(questionId) {
    return state.answers[questionId] || null;
  }

  function isComplete() {
    return state.totalAnswered === questions.length;
  }

  function getProgress() {
    return {
      current: state.currentIndex + 1,
      total: questions.length,
      score: state.score,
      totalAnswered: state.totalAnswered
    };
  }

  return {
    init: init,
    getState: getState,
    setState: setState,
    getCurrentQuestion: getCurrentQuestion,
    submitAnswer: submitAnswer,
    nextQuestion: nextQuestion,
    prevQuestion: prevQuestion,
    reset: reset,
    getAnswer: getAnswer,
    isComplete: isComplete,
    getProgress: getProgress
  };
}

/**
 * Storage Manager — localStorage persistence for session state.
 * Accepts an optional storageBackend for testing (defaults to window.localStorage).
 */
function createStorage(storageBackend) {
  var STORAGE_KEY = 'sfAdminQuiz_session';
  var CURRENT_VERSION = 1;
  var backend = storageBackend || (typeof localStorage !== 'undefined' ? localStorage : null);

  function isAvailable() {
    try {
      var testKey = '__storage_test__';
      backend.setItem(testKey, '1');
      backend.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  function save(state) {
    if (!isAvailable()) {
      return false;
    }
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    if (!isAvailable()) {
      return null;
    }
    try {
      var raw = backend.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CURRENT_VERSION) {
        clear();
        return null;
      }
      return parsed;
    } catch (e) {
      clear();
      return null;
    }
  }

  function clear() {
    if (!isAvailable()) {
      return false;
    }
    try {
      backend.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    isAvailable: isAvailable,
    save: save,
    load: load,
    clear: clear
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createQuizEngine: createQuizEngine, createStorage: createStorage };
}
