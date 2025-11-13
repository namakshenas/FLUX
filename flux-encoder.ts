/**
 * FLUX: Format for LLM Understanding and eXchange
 * Core encoding implementation with adaptive compression
 */

// Type system
export const TypeMarkers = {
  INTEGER: '@i',
  FLOAT: '@f',
  STRING: '@s',
  BOOLEAN: '@b',
  TIMESTAMP: '@t',
  EMAIL: '@e',
  URL: '@u',
  UUID: '@$',
  HASH: '@h',
  JSON: '@j',
  NULL: '@n'
} as const

// Infer type from value
function inferType(value: any): string {
  if (value === null || value === undefined) return TypeMarkers.NULL
  if (typeof value === 'boolean') return TypeMarkers.BOOLEAN
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TypeMarkers.INTEGER : TypeMarkers.FLOAT
  }
  if (value instanceof Date) return TypeMarkers.TIMESTAMP
  if (typeof value === 'string') {
    // Check for special string patterns
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return TypeMarkers.EMAIL
    if (/^https?:\/\/.+/.test(value)) return TypeMarkers.URL
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return TypeMarkers.UUID
    if (/^[0-9a-f]{32,}$/i.test(value)) return TypeMarkers.HASH
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return TypeMarkers.TIMESTAMP
    return TypeMarkers.STRING
  }
  if (typeof value === 'object') return TypeMarkers.JSON
  return TypeMarkers.STRING
}

// Format value based on type
function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '-'
  
  switch (type) {
    case TypeMarkers.BOOLEAN:
      return value ? 'T' : 'F'
    case TypeMarkers.TIMESTAMP:
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    case TypeMarkers.STRING:
    case TypeMarkers.EMAIL:
    case TypeMarkers.URL:
    case TypeMarkers.UUID:
    case TypeMarkers.HASH:
      return needsQuoting(String(value)) ? `"${escapeString(String(value))}"` : String(value)
    case TypeMarkers.JSON:
      return JSON.stringify(value)
    default:
      return String(value)
  }
}

// Check if string needs quoting
function needsQuoting(str: string): boolean {
  if (str.length === 0) return true
  if (str !== str.trim()) return true // Leading/trailing spaces
  if (str.match(/[,\t|:"\\]|^-$|^T$|^F$/)) return true
  if (str.match(/^\d+$/) || str.match(/^-?\d*\.?\d+$/)) return true
  if (str === 'null' || str === 'true' || str === 'false') return true
  if (str.startsWith('- ')) return true
  return false
}

// Escape special characters
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// Analyze array patterns for optimal encoding
interface ArrayAnalysis {
  mode: 'columnar' | 'dictionary' | 'sparse' | 'list'
  fields?: string[]
  types?: string[]
  dictionary?: Map<string, number>
  sparseFields?: Set<string>
  nullPercentages?: Map<string, number>
}

function analyzeArray(arr: any[]): ArrayAnalysis {
  if (arr.length === 0) return { mode: 'list' }
  
  // Check if all elements are objects with same keys
  const first = arr[0]
  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    return { mode: 'list' }
  }
  
  const fields = Object.keys(first).sort()
  const allSameStructure = arr.every(item => {
    if (typeof item !== 'object' || item === null) return false
    const keys = Object.keys(item).sort()
    return keys.length === fields.length && keys.every((k, i) => k === fields[i])
  })
  
  if (!allSameStructure) return { mode: 'list' }
  
  // Analyze field patterns
  const types = fields.map(field => inferType(first[field]))
  const valueCounts = new Map<string, Map<any, number>>()
  const nullCounts = new Map<string, number>()
  
  fields.forEach(field => {
    valueCounts.set(field, new Map())
    nullCounts.set(field, 0)
  })
  
  arr.forEach(item => {
    fields.forEach(field => {
      const value = item[field]
      if (value === null || value === undefined) {
        nullCounts.set(field, (nullCounts.get(field) || 0) + 1)
      } else {
        const counts = valueCounts.get(field)!
        counts.set(value, (counts.get(value) || 0) + 1)
      }
    })
  })
  
  // Calculate null percentages
  const nullPercentages = new Map<string, number>()
  fields.forEach(field => {
    const nullCount = nullCounts.get(field) || 0
    nullPercentages.set(field, (nullCount / arr.length) * 100)
  })
  
  // Check for sparse fields (>30% null)
  const sparseFields = new Set<string>()
  let totalSparsePercent = 0
  fields.forEach(field => {
    const percent = nullPercentages.get(field) || 0
    if (percent > 30) {
      sparseFields.add(field)
      totalSparsePercent += percent
    }
  })
  
  // Check for dictionary candidates (repeated values)
  let hasDictionaryCandidates = false
  const dictionary = new Map<string, number>()
  
  fields.forEach(field => {
    const counts = valueCounts.get(field)!
    const uniqueValues = counts.size
    const totalValues = arr.length - (nullCounts.get(field) || 0)
    
    // If field has few unique values relative to total, it's a dictionary candidate
    if (uniqueValues > 0 && uniqueValues < totalValues * 0.3 && uniqueValues < 50) {
      hasDictionaryCandidates = true
    }
  })
  
  // Choose mode
  if (sparseFields.size > fields.length * 0.3) {
    return { mode: 'sparse', fields, types, sparseFields, nullPercentages }
  }
  
  if (hasDictionaryCandidates && arr.length > 10) {
    return { mode: 'dictionary', fields, types }
  }
  
  return { mode: 'columnar', fields, types }
}

// Calculate statistics for array
interface Statistics {
  sum?: Record<string, number>
  avg?: Record<string, number>
  min?: Record<string, number>
  max?: Record<string, number>
  p50?: Record<string, number>
  p95?: Record<string, number>
}

function calculateStats(arr: any[], fields: string[], types: string[]): Statistics {
  const stats: Statistics = {
    sum: {},
    avg: {},
    min: {},
    max: {}
  }
  
  fields.forEach((field, idx) => {
    const type = types[idx]
    if (type === TypeMarkers.INTEGER || type === TypeMarkers.FLOAT) {
      const values = arr.map(item => item[field]).filter(v => v != null)
      if (values.length > 0) {
        stats.sum![field] = values.reduce((a, b) => a + b, 0)
        stats.avg![field] = stats.sum![field] / values.length
        stats.min![field] = Math.min(...values)
        stats.max![field] = Math.max(...values)
      }
    }
  })
  
  return stats
}

// Encoding options
export interface EncodeOptions {
  mode?: 'auto' | 'columnar' | 'dictionary' | 'sparse'
  indent?: number
  types?: boolean
  stats?: boolean
  compress?: boolean
  maxDictSize?: number
  sparseThreshold?: number
}

// Main encode function
export function encode(value: any, options: EncodeOptions = {}): string {
  const {
    mode = 'auto',
    indent = 2,
    types = true,
    stats = false,
    compress = false
  } = options
  
  const lines: string[] = []
  
  function encodeValue(val: any, depth: number = 0): void {
    const spaces = ' '.repeat(depth * indent)
    
    if (val === null || val === undefined) {
      lines.push(`${spaces}-`)
      return
    }
    
    if (Array.isArray(val)) {
      encodeArray(val, depth)
      return
    }
    
    if (typeof val === 'object' && !(val instanceof Date)) {
      encodeObject(val, depth)
      return
    }
    
    // Primitive value
    const type = inferType(val)
    lines.push(`${spaces}${formatValue(val, type)}`)
  }
  
  function encodeArray(arr: any[], depth: number, name?: string): void {
    const spaces = ' '.repeat(depth * indent)
    const prefix = name ? `${name}` : ''
    
    if (arr.length === 0) {
      lines.push(`${spaces}${prefix}[0]:`)
      return
    }
    
    const analysis = analyzeArray(arr)
    
    if (analysis.mode === 'columnar' && analysis.fields && analysis.types) {
      // Columnar encoding
      const fieldStr = analysis.fields.join(',')
      const typeStr = types ? '\n' + spaces + '  ' + analysis.types.join(' ') : ''
      
      let header = `${spaces}@${prefix}[${arr.length}]:`
      if (types) {
        header += '\n' + spaces + '  ' + analysis.fields.join(' ')
        header += '\n' + spaces + '  ' + analysis.types.join(' ')
      } else {
        header += '\n' + spaces + '  ' + fieldStr
      }
      
      lines.push(header)
      
      // Add statistics if requested
      if (stats && arr.length > 5) {
        const statistics = calculateStats(arr, analysis.fields, analysis.types)
        if (Object.keys(statistics.sum || {}).length > 0) {
          const statValues = analysis.fields.map(f => 
            statistics.sum![f] !== undefined ? statistics.sum![f] : ''
          )
          lines.push(`${spaces}  sum:,${statValues.join(',')}`)
          
          const avgValues = analysis.fields.map(f =>
            statistics.avg![f] !== undefined ? statistics.avg![f].toFixed(2) : ''
          )
          lines.push(`${spaces}  avg:,${avgValues.join(',')}`)
        }
      }
      
      // Data rows
      arr.forEach(item => {
        const rowValues = analysis.fields!.map((field, idx) => {
          const val = item[field]
          return formatValue(val, analysis.types![idx])
        })
        lines.push(`${spaces}  ${rowValues.join(',')}`)
      })
      
    } else if (analysis.mode === 'sparse' && analysis.fields && analysis.types && analysis.sparseFields) {
      // Sparse encoding
      const fieldMarkers = analysis.fields.map(f => 
        analysis.sparseFields!.has(f) ? f + '?' : f
      )
      
      let header = `${spaces}@${prefix}[${arr.length}]?:`
      header += '\n' + spaces + '  ' + fieldMarkers.join(' ')
      if (types) {
        header += '\n' + spaces + '  ' + analysis.types.join(' ')
      }
      
      lines.push(header)
      
      arr.forEach(item => {
        const rowValues = analysis.fields!.map((field, idx) => {
          const val = item[field]
          return formatValue(val, analysis.types![idx])
        })
        lines.push(`${spaces}  ${rowValues.join(',')}`)
      })
      
    } else {
      // List encoding
      lines.push(`${spaces}${prefix}[${arr.length}]:`)
      arr.forEach(item => {
        if (typeof item === 'object' && !Array.isArray(item) && item !== null) {
          lines.push(`${spaces}- `)
          const keys = Object.keys(item)
          keys.forEach((key, idx) => {
            const val = item[key]
            const valType = inferType(val)
            const formatted = formatValue(val, valType)
            const line = idx === 0 ? 
              `${spaces}- ${key}: ${formatted}` :
              `${spaces}  ${key}: ${formatted}`
            if (idx === 0) {
              lines[lines.length - 1] = line
            } else {
              lines.push(line)
            }
          })
        } else {
          const itemType = inferType(item)
          lines.push(`${spaces}- ${formatValue(item, itemType)}`)
        }
      })
    }
  }
  
  function encodeObject(obj: any, depth: number): void {
    const spaces = ' '.repeat(depth * indent)
    const keys = Object.keys(obj)
    
    keys.forEach(key => {
      const val = obj[key]
      
      if (Array.isArray(val)) {
        encodeArray(val, depth, key)
      } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        lines.push(`${spaces}${key}:`)
        encodeObject(val, depth + 1)
      } else {
        const type = inferType(val)
        const formatted = formatValue(val, type)
        lines.push(`${spaces}${key}: ${formatted}`)
      }
    })
  }
  
  encodeValue(value, 0)
  
  let result = lines.join('\n')
  
  if (compress) {
    // Add compression marker
    result = '#FLUX:COMPRESSED\n' + result
  }
  
  return result
}

// Export for use
export default { encode, TypeMarkers }
