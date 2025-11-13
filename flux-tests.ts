/**
 * FLUX Test Suite
 * Comprehensive tests for encoding and decoding
 */

import { encode } from './flux-encoder'
import { decode } from './flux-decoder'

// Test utilities
let passedTests = 0
let failedTests = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passedTests++
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error}`)
    failedTests++
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`)
  }
}

function assertIncludes(text: string, substring: string, message?: string) {
  if (!text.includes(substring)) {
    throw new Error(message || `Expected text to include "${substring}"`)
  }
}

console.log('='.repeat(80))
console.log('FLUX TEST SUITE')
console.log('='.repeat(80))
console.log()

// Basic encoding tests
console.log('BASIC ENCODING TESTS')
console.log('-'.repeat(80))

test('Encode simple object', () => {
  const data = { name: 'Alice', age: 25 }
  const result = encode(data)
  assertIncludes(result, 'name: Alice')
  assertIncludes(result, 'age: 25')
})

test('Encode array of primitives', () => {
  const data = { tags: ['admin', 'user', 'moderator'] }
  const result = encode(data)
  assertIncludes(result, 'tags[3]:')
  assertIncludes(result, 'admin,user,moderator')
})

test('Encode array of objects (columnar)', () => {
  const data = {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
  }
  const result = encode(data, { types: true })
  assertIncludes(result, '@users[2]:')
  assertIncludes(result, 'id name')
  assertIncludes(result, '@i @s')
  assertIncludes(result, '1,Alice')
  assertIncludes(result, '2,Bob')
})

test('Encode boolean values', () => {
  const data = { active: true, verified: false }
  const result = encode(data)
  assertIncludes(result, 'active: T')
  assertIncludes(result, 'verified: F')
})

test('Encode null values', () => {
  const data = { name: 'Alice', email: null }
  const result = encode(data)
  assertIncludes(result, 'email: -')
})

test('Encode nested objects', () => {
  const data = {
    user: {
      profile: {
        name: 'Alice',
        age: 25
      }
    }
  }
  const result = encode(data)
  assertIncludes(result, 'user:')
  assertIncludes(result, 'profile:')
  assertIncludes(result, 'name: Alice')
})

test('Encode email detection', () => {
  const data = {
    users: [
      { email: 'alice@example.com' },
      { email: 'bob@test.org' }
    ]
  }
  const result = encode(data, { types: true })
  assertIncludes(result, '@e') // Email type marker
})

test('Encode URL detection', () => {
  const data = {
    links: [
      { url: 'https://example.com' },
      { url: 'http://test.org/path' }
    ]
  }
  const result = encode(data, { types: true })
  assertIncludes(result, '@u') // URL type marker
})

test('Encode UUID detection', () => {
  const data = {
    records: [
      { id: '550e8400-e29b-41d4-a716-446655440000' }
    ]
  }
  const result = encode(data, { types: true })
  assertIncludes(result, '@$') // UUID type marker
})

// Sparse encoding tests
console.log('\nSPARSE ENCODING TESTS')
console.log('-'.repeat(80))

test('Detect sparse fields', () => {
  const data = {
    logs: [
      { id: 1, error: null, stack: null },
      { id: 2, error: null, stack: null },
      { id: 3, error: 'E404', stack: 'trace...' },
      { id: 4, error: null, stack: null },
      { id: 5, error: null, stack: null }
    ]
  }
  const result = encode(data, { types: true, sparseThreshold: 30 })
  assertIncludes(result, '?:') // Sparse marker
})

// Statistics tests
console.log('\nSTATISTICS TESTS')
console.log('-'.repeat(80))

test('Include statistics for numeric data', () => {
  const data = {
    sales: [
      { day: 1, amount: 100 },
      { day: 2, amount: 200 },
      { day: 3, amount: 150 },
      { day: 4, amount: 300 },
      { day: 5, amount: 250 },
      { day: 6, amount: 180 }
    ]
  }
  const result = encode(data, { stats: true })
  assertIncludes(result, 'sum:')
  assertIncludes(result, 'avg:')
})

// Quoting tests
console.log('\nQUOTING TESTS')
console.log('-'.repeat(80))

test('Quote strings with commas', () => {
  const data = { description: 'Hello, world' }
  const result = encode(data)
  assertIncludes(result, '"Hello, world"')
})

test('Quote strings that look like booleans', () => {
  const data = { value: 'true', flag: true }
  const result = encode(data)
  assertIncludes(result, 'value: "true"')
  assertIncludes(result, 'flag: T')
})

test('Quote strings with leading/trailing spaces', () => {
  const data = { text: ' padded ' }
  const result = encode(data)
  assertIncludes(result, '" padded "')
})

test('No quotes for simple strings', () => {
  const data = { name: 'Alice' }
  const result = encode(data)
  assertIncludes(result, 'name: Alice')
})

// Decoding tests
console.log('\nDECODING TESTS')
console.log('-'.repeat(80))

test('Decode simple object', () => {
  const flux = 'name: Alice\nage: 25'
  const result = decode(flux)
  assertEqual(result.name, 'Alice')
  assertEqual(result.age, 25)
})

test('Decode array of primitives', () => {
  const flux = 'tags[3]: admin,user,moderator'
  const result = decode(flux)
  assertEqual(result.tags, ['admin', 'user', 'moderator'])
})

test('Decode columnar array', () => {
  const flux = `@users[2]:
  id name
  @i @s
  1,Alice
  2,Bob`
  const result = decode(flux)
  assertEqual(result.users.length, 2)
  assertEqual(result.users[0].id, 1)
  assertEqual(result.users[0].name, 'Alice')
  assertEqual(result.users[1].id, 2)
  assertEqual(result.users[1].name, 'Bob')
})

test('Decode boolean values', () => {
  const flux = 'active: T\nverified: F'
  const result = decode(flux)
  assertEqual(result.active, true)
  assertEqual(result.verified, false)
})

test('Decode null values', () => {
  const flux = 'name: Alice\nemail: -'
  const result = decode(flux)
  assertEqual(result.name, 'Alice')
  assertEqual(result.email, null)
})

// Round-trip tests
console.log('\nROUND-TRIP TESTS')
console.log('-'.repeat(80))

test('Round-trip simple object', () => {
  const original = { name: 'Alice', age: 25, active: true }
  const encoded = encode(original)
  const decoded = decode(encoded)
  assertEqual(decoded, original)
})

test('Round-trip array of objects', () => {
  const original = {
    users: [
      { id: 1, name: 'Alice', verified: true },
      { id: 2, name: 'Bob', verified: false }
    ]
  }
  const encoded = encode(original, { types: true })
  const decoded = decode(encoded)
  assertEqual(decoded, original)
})

test('Round-trip with nulls', () => {
  const original = {
    items: [
      { id: 1, name: 'Item1', note: null },
      { id: 2, name: 'Item2', note: 'Has note' }
    ]
  }
  const encoded = encode(original, { types: true })
  const decoded = decode(encoded)
  assertEqual(decoded, original)
})

test('Round-trip nested objects', () => {
  const original = {
    user: {
      id: 1,
      profile: {
        name: 'Alice',
        age: 25
      }
    }
  }
  const encoded = encode(original)
  const decoded = decode(encoded)
  assertEqual(decoded, original)
})

// Edge cases
console.log('\nEDGE CASE TESTS')
console.log('-'.repeat(80))

test('Empty array', () => {
  const data = { items: [] }
  const result = encode(data)
  assertIncludes(result, 'items[0]:')
})

test('Empty object', () => {
  const data = { config: {} }
  const result = encode(data)
  assertIncludes(result, 'config:')
})

test('Array with single item', () => {
  const data = { tags: ['solo'] }
  const result = encode(data)
  assertIncludes(result, 'tags[1]: solo')
})

test('Large numbers', () => {
  const data = { amount: 9007199254740991 }
  const result = encode(data)
  assertIncludes(result, '9007199254740991')
})

test('Float precision', () => {
  const data = { price: 19.99 }
  const result = encode(data)
  assertIncludes(result, '19.99')
})

test('Special characters in strings', () => {
  const data = { path: 'C:\\Users\\Alice' }
  const result = encode(data)
  assertIncludes(result, 'C:\\\\Users\\\\Alice')
})

// Performance comparison test
console.log('\nPERFORMANCE COMPARISON')
console.log('-'.repeat(80))

test('Token efficiency on large dataset', () => {
  const data = {
    records: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
      email: `user${i + 1}@example.com`,
      score: Math.floor(Math.random() * 1000),
      active: Math.random() > 0.5
    }))
  }
  
  const json = JSON.stringify(data, null, 2)
  const jsonCompact = JSON.stringify(data)
  const flux = encode(data, { types: true })
  
  const jsonTokens = Math.ceil(json.length / 4)
  const jsonCompactTokens = Math.ceil(jsonCompact.length / 4)
  const fluxTokens = Math.ceil(flux.length / 4)
  
  const savings = ((jsonTokens - fluxTokens) / jsonTokens * 100).toFixed(1)
  const savingsCompact = ((jsonCompactTokens - fluxTokens) / jsonCompactTokens * 100).toFixed(1)
  
  console.log(`  JSON (formatted): ${jsonTokens} tokens`)
  console.log(`  JSON (compact): ${jsonCompactTokens} tokens`)
  console.log(`  FLUX: ${fluxTokens} tokens`)
  console.log(`  Savings vs formatted: ${savings}%`)
  console.log(`  Savings vs compact: ${savingsCompact}%`)
  
  // FLUX should use fewer tokens
  if (fluxTokens >= jsonTokens) {
    throw new Error('FLUX should use fewer tokens than formatted JSON')
  }
})

// Summary
console.log('\n' + '='.repeat(80))
console.log('TEST SUMMARY')
console.log('='.repeat(80))
console.log(`Passed: ${passedTests}`)
console.log(`Failed: ${failedTests}`)
console.log(`Total: ${passedTests + failedTests}`)

if (failedTests === 0) {
  console.log('\n✓ All tests passed!')
} else {
  console.log(`\n✗ ${failedTests} test(s) failed`)
  process.exit(1)
}
