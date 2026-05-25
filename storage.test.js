'use strict';

const { createStorage } = require('./quiz-engine');

/**
 * In-memory localStorage mock for Node.js testing.
 */
function createMockStorage() {
  var store = {};
  return {
    getItem: function(key) { return store.hasOwnProperty(key) ? store[key] : null; },
    setItem: function(key, value) { store[key] = String(value); },
    removeItem: function(key) { delete store[key]; },
    clear: function() { store = {}; },
    _store: store
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error('FAIL: ' + message);
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
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

  console.log('Storage Manager Tests\n');

  // Task 3.1: isAvailable()
  test('isAvailable() returns true with working storage backend', function() {
    var storage = createStorage(createMockStorage());
    assert(storage.isAvailable() === true, 'should be true');
  });

  test('isAvailable() returns false when storage throws', function() {
    var brokenBackend = {
      setItem: function() { throw new Error('QuotaExceeded'); },
      removeItem: function() {}
    };
    var storage = createStorage(brokenBackend);
    assert(storage.isAvailable() === false, 'should be false');
  });

  // Task 3.2: save()
  test('save() serializes state to storage', function() {
    var mock = createMockStorage();
    var storage = createStorage(mock);
    var state = { currentIndex: 5, answers: {}, score: 2, totalAnswered: 5, startedAt: '2024-01-01T00:00:00.000Z', version: 1 };
    var result = storage.save(state);
    assert(result === true, 'should return true');
    assert(mock.getItem('sfAdminQuiz_session') !== null, 'should have stored data');
  });

  test('save() returns false when storage is unavailable', function() {
    var brokenBackend = {
      setItem: function() { throw new Error('QuotaExceeded'); },
      removeItem: function() { throw new Error('nope'); }
    };
    var storage = createStorage(brokenBackend);
    var result = storage.save({ version: 1 });
    assert(result === false, 'should return false');
  });

  // Task 3.3: load()
  test('load() returns null when no saved state', function() {
    var storage = createStorage(createMockStorage());
    assert(storage.load() === null, 'should be null');
  });

  test('load() deserializes saved state correctly (round-trip)', function() {
    var mock = createMockStorage();
    var storage = createStorage(mock);
    var state = { currentIndex: 3, answers: { 1: { selected: ['B'], correct: true } }, score: 1, totalAnswered: 1, startedAt: '2024-01-01T00:00:00.000Z', version: 1 };
    storage.save(state);
    var loaded = storage.load();
    assert(deepEqual(loaded, state), 'loaded state should deeply equal saved state');
  });

  test('load() returns null on corrupted JSON', function() {
    var mock = createMockStorage();
    mock.setItem('sfAdminQuiz_session', '{invalid json!!!');
    var storage = createStorage(mock);
    var result = storage.load();
    assert(result === null, 'should return null for corrupted data');
  });

  test('load() returns null and clears on version mismatch', function() {
    var mock = createMockStorage();
    mock.setItem('sfAdminQuiz_session', JSON.stringify({ version: 99, currentIndex: 0 }));
    var storage = createStorage(mock);
    var result = storage.load();
    assert(result === null, 'should return null for version mismatch');
    assert(mock.getItem('sfAdminQuiz_session') === null, 'should have cleared the invalid data');
  });

  // Task 3.4: clear()
  test('clear() removes saved session', function() {
    var mock = createMockStorage();
    var storage = createStorage(mock);
    storage.save({ version: 1, currentIndex: 0, answers: {}, score: 0, totalAnswered: 0, startedAt: '2024-01-01T00:00:00.000Z' });
    assert(mock.getItem('sfAdminQuiz_session') !== null, 'should have data before clear');
    var result = storage.clear();
    assert(result === true, 'should return true');
    assert(mock.getItem('sfAdminQuiz_session') === null, 'should be null after clear');
  });

  test('clear() returns false when storage is unavailable', function() {
    var brokenBackend = {
      setItem: function() { throw new Error('nope'); },
      removeItem: function() { throw new Error('nope'); }
    };
    var storage = createStorage(brokenBackend);
    var result = storage.clear();
    assert(result === false, 'should return false');
  });

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
