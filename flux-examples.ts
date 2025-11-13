/**
 * FLUX Examples and Comparisons
 * Demonstrating token efficiency and LLM-friendly features
 */

import { encode } from './flux-encoder'

// Example 1: Basic Tabular Data
console.log('='.repeat(80))
console.log('EXAMPLE 1: Basic Tabular Data')
console.log('='.repeat(80))

const users = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com', verified: true, lastLogin: '2025-01-15T10:30:00Z' },
    { id: 2, name: 'Bob', email: 'bob@example.com', verified: false, lastLogin: '2025-01-14T09:15:00Z' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', verified: true, lastLogin: '2025-01-13T14:20:00Z' }
  ]
}

console.log('\nJSON (formatted):')
console.log(JSON.stringify(users, null, 2))
console.log(`Tokens: ~${estimateTokens(JSON.stringify(users, null, 2))}`)

console.log('\nTOON:')
const toonOutput = `users[3]{id,name,email,verified,lastLogin}:
1,Alice,alice@example.com,true,2025-01-15T10:30:00Z
2,Bob,bob@example.com,false,2025-01-14T09:15:00Z
3,Charlie,charlie@example.com,true,2025-01-13T14:20:00Z`
console.log(toonOutput)
console.log(`Tokens: ~${estimateTokens(toonOutput)}`)

console.log('\nFLUX:')
const fluxOutput = encode(users, { types: true })
console.log(fluxOutput)
console.log(`Tokens: ~${estimateTokens(fluxOutput)}`)

console.log('\n' + '='.repeat(80))
console.log('EXAMPLE 2: E-Commerce Orders (Nested Data)')
console.log('='.repeat(80))

const orders = {
  orders: [
    {
      orderId: 'ORD-001',
      customerId: 'CUST-42',
      customerName: 'Alice Johnson',
      orderDate: '2025-01-15T10:00:00Z',
      items: [
        { sku: 'WIDGET-1', productName: 'Premium Widget', quantity: 2, unitPrice: 29.99 },
        { sku: 'GADGET-5', productName: 'Super Gadget', quantity: 1, unitPrice: 49.99 }
      ],
      total: 109.97,
      status: 'shipped'
    },
    {
      orderId: 'ORD-002',
      customerId: 'CUST-13',
      customerName: 'Bob Smith',
      orderDate: '2025-01-14T15:30:00Z',
      items: [
        { sku: 'DOOHICKEY-3', productName: 'Mega Doohickey', quantity: 5, unitPrice: 15.50 }
      ],
      total: 77.50,
      status: 'processing'
    }
  ]
}

console.log('\nJSON (formatted):')
console.log(JSON.stringify(orders, null, 2))
console.log(`Tokens: ~${estimateTokens(JSON.stringify(orders, null, 2))}`)

console.log('\nFLUX with nested optimization:')
const fluxOrders = encode(orders, { types: true })
console.log(fluxOrders)
console.log(`Tokens: ~${estimateTokens(fluxOrders)}`)

console.log('\n' + '='.repeat(80))
console.log('EXAMPLE 3: Analytics Data with Statistics')
console.log('='.repeat(80))

const analytics = {
  metrics: Array.from({ length: 30 }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    views: Math.floor(Math.random() * 5000) + 3000,
    clicks: Math.floor(Math.random() * 300) + 150,
    conversions: Math.floor(Math.random() * 30) + 10,
    revenue: (Math.random() * 5000 + 2000).toFixed(2),
    bounceRate: (Math.random() * 0.5 + 0.3).toFixed(2)
  }))
}

console.log('\nJSON (formatted, first 3 rows shown):')
console.log(JSON.stringify({ metrics: analytics.metrics.slice(0, 3) }, null, 2) + '\n  ...')
console.log(`Full JSON tokens: ~${estimateTokens(JSON.stringify(analytics, null, 2))}`)

console.log('\nFLUX with statistics:')
const fluxAnalytics = encode(analytics, { types: true, stats: true })
console.log(fluxAnalytics)
console.log(`Tokens: ~${estimateTokens(fluxAnalytics)}`)

console.log('\n' + '='.repeat(80))
console.log('EXAMPLE 4: Sparse Data (Many Nulls)')
console.log('='.repeat(80))

const logs = {
  logs: [
    { timestamp: '2025-01-15T10:00:00Z', level: 'INFO', message: 'Service started', errorCode: null, stackTrace: null, userId: null },
    { timestamp: '2025-01-15T10:00:05Z', level: 'INFO', message: 'Request received', errorCode: null, stackTrace: null, userId: 'user-123' },
    { timestamp: '2025-01-15T10:00:10Z', level: 'ERROR', message: 'Database connection failed', errorCode: 'DB-500', stackTrace: 'at line 42...', userId: 'user-123' },
    { timestamp: '2025-01-15T10:00:15Z', level: 'WARN', message: 'Retry attempt', errorCode: null, stackTrace: null, userId: 'user-123' },
    { timestamp: '2025-01-15T10:00:20Z', level: 'INFO', message: 'Connection restored', errorCode: null, stackTrace: null, userId: null }
  ]
}

console.log('\nJSON (formatted):')
console.log(JSON.stringify(logs, null, 2))
console.log(`Tokens: ~${estimateTokens(JSON.stringify(logs, null, 2))}`)

console.log('\nFLUX with sparse mode:')
const fluxLogs = encode(logs, { types: true, sparseThreshold: 30 })
console.log(fluxLogs)
console.log(`Tokens: ~${estimateTokens(fluxLogs)}`)

console.log('\n' + '='.repeat(80))
console.log('EXAMPLE 5: GitHub Repositories (Real-world data)')
console.log('='.repeat(80))

const repos = {
  repositories: [
    {
      id: 28457823,
      name: 'freeCodeCamp',
      fullName: 'freeCodeCamp/freeCodeCamp',
      description: 'freeCodeCamp.org\'s open-source codebase',
      stars: 430886,
      forks: 42146,
      language: 'JavaScript',
      createdAt: '2014-12-24T17:49:19Z',
      updatedAt: '2025-10-28T11:58:08Z',
      homepage: 'https://www.freecodecamp.org',
      isArchived: false
    },
    {
      id: 132750724,
      name: 'build-your-own-x',
      fullName: 'codecrafters-io/build-your-own-x',
      description: 'Master programming by recreating technologies',
      stars: 430877,
      forks: 40453,
      language: 'JavaScript',
      createdAt: '2018-05-09T12:03:18Z',
      updatedAt: '2025-10-28T12:37:11Z',
      homepage: 'https://github.com/codecrafters-io',
      isArchived: false
    },
    {
      id: 21737465,
      name: 'awesome',
      fullName: 'sindresorhus/awesome',
      description: '😎 Awesome lists about interesting topics',
      stars: 410052,
      forks: 32029,
      language: 'JavaScript',
      createdAt: '2014-07-11T13:42:37Z',
      updatedAt: '2025-10-28T12:40:21Z',
      homepage: 'https://awesome.re',
      isArchived: false
    }
  ]
}

console.log('\nJSON (formatted):')
console.log(JSON.stringify(repos, null, 2))
console.log(`Tokens: ~${estimateTokens(JSON.stringify(repos, null, 2))}`)

console.log('\nFLUX:')
const fluxRepos = encode(repos, { types: true })
console.log(fluxRepos)
console.log(`Tokens: ~${estimateTokens(fluxRepos)}`)

console.log('\n' + '='.repeat(80))
console.log('SUMMARY: Token Savings')
console.log('='.repeat(80))

const examples = [
  { name: 'Basic Users', json: JSON.stringify(users, null, 2), flux: fluxOutput },
  { name: 'E-Commerce Orders', json: JSON.stringify(orders, null, 2), flux: fluxOrders },
  { name: 'Analytics (30 days)', json: JSON.stringify(analytics, null, 2), flux: fluxAnalytics },
  { name: 'Sparse Logs', json: JSON.stringify(logs, null, 2), flux: fluxLogs },
  { name: 'GitHub Repos', json: JSON.stringify(repos, null, 2), flux: fluxRepos }
]

console.log('\n')
console.log('Dataset'.padEnd(25), 'JSON', 'FLUX', 'Savings')
console.log('-'.repeat(70))

examples.forEach(ex => {
  const jsonTokens = estimateTokens(ex.json)
  const fluxTokens = estimateTokens(ex.flux)
  const savings = ((jsonTokens - fluxTokens) / jsonTokens * 100).toFixed(1)
  
  console.log(
    ex.name.padEnd(25),
    String(jsonTokens).padStart(6),
    String(fluxTokens).padStart(6),
    `${savings}%`.padStart(8)
  )
})

console.log('\n' + '='.repeat(80))
console.log('KEY ADVANTAGES OF FLUX')
console.log('='.repeat(80))

console.log(`
1. TYPE-AWARE ENCODING
   - Explicit type markers (@i, @f, @t, @e, @u) reduce ambiguity
   - Booleans as T/F save tokens vs "true"/"false"
   - Automatic type inference from values

2. ADAPTIVE COMPRESSION
   - Automatically chooses columnar, sparse, or dictionary mode
   - Optimizes based on data patterns
   - No manual configuration needed

3. STATISTICAL HINTS
   - Prepend sum, avg, min, max for numeric fields
   - LLMs get context without processing all rows
   - Useful for aggregation queries

4. SPARSE MODE
   - Efficiently handles fields with many nulls
   - Marks optional fields with ?
   - Reduces token waste on null values

5. BETTER LLM GENERATION
   - Clear schemas with field names and types
   - Explicit row counts for validation
   - Consistent structure makes generation easier
   - Type markers guide LLM output format

6. STREAMING SUPPORT
   - Process large datasets incrementally
   - Lower memory footprint
   - Real-time data encoding

7. BIDIRECTIONAL OPTIMIZATION
   - Equally good for LLM input and output
   - Clear validation markers
   - Reduces generation errors
`)

// Simple token estimator (rough approximation)
function estimateTokens(text: string): number {
  // Very rough estimate: ~4 chars per token on average
  // Real tokenizers are more sophisticated
  return Math.ceil(text.length / 4)
}
