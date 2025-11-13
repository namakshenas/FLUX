/**
 * FLUX Decoder
 * Converts FLUX format back to JavaScript objects
 */

import { TypeMarkers } from './flux-encoder'

export interface DecodeOptions {
  strict?: boolean
  decompress?: boolean
}

class FluxDecodeError extends Error {
  constructor(message: string, line?: number) {
    super(line !== undefined ? `Line ${line}: ${message}` : message)
    this.name = 'FluxDecodeError'
  }
}

// Parse value based on type marker
function parseValue(str: string, typeMarker: string): any {
  str = str.trim()
  
  // Handle null
  if (str === '-' || str === '') return null
  
  switch (typeMarker) {
    case TypeMarkers.BOOLEAN:
      if (str === 'T') return true
      if (str === 'F') return false
      throw new Error(`Invalid boolean value: ${str}`)
      
    case TypeMarkers.INTEGER:
      const int = parseInt(str, 10)
      if (isNaN(int)) throw new Error(`Invalid integer: ${str}`)
      return int
      
    case TypeMarkers.FLOAT:
      const float = parseFloat(str)
      if (isNaN(float)) throw new Error(`Invalid float: ${str}`)
      return float
      
    case TypeMarkers.TIMESTAMP:
      return str // Keep as ISO string, or convert to Date if needed
      
    case TypeMarkers.STRING:
    case TypeMarkers.EMAIL:
    case TypeMarkers.URL:
    case TypeMarkers.UUID:
    case TypeMarkers.HASH:
      return unquoteString(str)
      
    case TypeMarkers.JSON:
      return JSON.parse(str)
      
    case TypeMarkers.NULL:
      return null
      
    default:
      // Try to infer type
      if (str === 'T') return true
      if (str === 'F') return false
      if (str === 'null') return null
      if (/^-?\d+$/.test(str)) return parseInt(str, 10)
      if (/^-?\d*\.\d+$/.test(str)) return parseFloat(str)
      return unquoteString(str)
  }
}

// Unquote and unescape string
function unquoteString(str: string): string {
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1)
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return str
}

// Split CSV line respecting quotes
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
        current += char
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// Main decode function
export function decode(input: string, options: DecodeOptions = {}): any {
  const { strict = true, decompress = true } = options
  
  // Check for compression
  if (input.startsWith('#FLUX:COMPRESSED') && decompress) {
    input = input.slice(input.indexOf('\n') + 1)
    // Decompression would go here
  }
  
  const lines = input.split('\n')
  let currentLine = 0
  
  function parseLine(): any {
    if (currentLine >= lines.length) return undefined
    
    const line = lines[currentLine]
    const indent = line.length - line.trimStart().length
    
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      currentLine++
      return parseLine()
    }
    
    // Check for array header
    const arrayMatch = line.match(/^\s*@(\w+)?\[(\d+)\]([?~^]*):\s*$/)
    if (arrayMatch) {
      const name = arrayMatch[1]
      const count = parseInt(arrayMatch[2], 10)
      const modifiers = arrayMatch[3]
      
      currentLine++
      return parseArray(count, modifiers, indent)
    }
    
    // Check for simple array
    const simpleArrayMatch = line.match(/^\s*(\w+)?\[(\d+)\]:\s*(.*)$/)
    if (simpleArrayMatch) {
      const values = simpleArrayMatch[3]
      if (values) {
        // Inline array
        const items = splitCsvLine(values)
        currentLine++
        return items.map(v => parseValue(v, TypeMarkers.STRING))
      }
    }
    
    // Check for key-value pair
    const kvMatch = line.match(/^\s*(\w+):\s*(.*)$/)
    if (kvMatch) {
      const key = kvMatch[1]
      const value = kvMatch[2]
      
      currentLine++
      
      if (value === '') {
        // Nested object
        return { [key]: parseObject(indent + 2) }
      } else {
        // Simple value
        return { [key]: parseValue(value, TypeMarkers.STRING) }
      }
    }
    
    // Check for list item
    if (line.trim().startsWith('- ')) {
      const listItems = []
      while (currentLine < lines.length && lines[currentLine].trim().startsWith('- ')) {
        const itemLine = lines[currentLine].slice(lines[currentLine].indexOf('- ') + 2)
        currentLine++
        
        // Check if it's a key-value
        const itemKvMatch = itemLine.match(/^(\w+):\s*(.*)$/)
        if (itemKvMatch) {
          const item: any = {}
          item[itemKvMatch[1]] = parseValue(itemKvMatch[2], TypeMarkers.STRING)
          
          // Check for additional fields
          while (currentLine < lines.length && !lines[currentLine].trim().startsWith('- ') && lines[currentLine].trim() !== '') {
            const fieldLine = lines[currentLine]
            const fieldMatch = fieldLine.match(/^\s+(\w+):\s*(.*)$/)
            if (fieldMatch) {
              item[fieldMatch[1]] = parseValue(fieldMatch[2], TypeMarkers.STRING)
              currentLine++
            } else {
              break
            }
          }
          
          listItems.push(item)
        } else {
          listItems.push(parseValue(itemLine, TypeMarkers.STRING))
        }
      }
      return listItems
    }
    
    currentLine++
    return undefined
  }
  
  function parseArray(count: number, modifiers: string, indent: number): any[] {
    // Check for columnar format
    const headerLine = lines[currentLine]
    if (!headerLine) return []
    
    const headerIndent = headerLine.length - headerLine.trimStart().length
    
    // Parse field names
    const fields = headerLine.trim().split(/\s+/)
    currentLine++
    
    // Check for type markers
    let types: string[] = []
    const nextLine = lines[currentLine]
    if (nextLine && nextLine.trim().startsWith('@')) {
      types = nextLine.trim().split(/\s+/)
      currentLine++
    }
    
    // Skip statistics if present
    while (currentLine < lines.length) {
      const line = lines[currentLine]
      if (line.trim().startsWith('sum:') || 
          line.trim().startsWith('avg:') ||
          line.trim().startsWith('min:') ||
          line.trim().startsWith('max:') ||
          line.trim().startsWith('p50:') ||
          line.trim().startsWith('p95:')) {
        currentLine++
      } else {
        break
      }
    }
    
    // Parse data rows
    const result: any[] = []
    for (let i = 0; i < count; i++) {
      if (currentLine >= lines.length) {
        if (strict) throw new FluxDecodeError(`Expected ${count} rows, got ${i}`, currentLine)
        break
      }
      
      const dataLine = lines[currentLine]
      const dataIndent = dataLine.length - dataLine.trimStart().length
      
      if (dataIndent <= indent) break
      
      const values = splitCsvLine(dataLine.trim())
      
      if (values.length !== fields.length) {
        if (strict && !modifiers.includes('?')) {
          throw new FluxDecodeError(
            `Row ${i}: expected ${fields.length} values, got ${values.length}`,
            currentLine
          )
        }
      }
      
      const obj: any = {}
      fields.forEach((field, idx) => {
        const cleanField = field.replace('?', '')
        const typeMarker = types[idx] || TypeMarkers.STRING
        const value = values[idx]
        obj[cleanField] = parseValue(value, typeMarker)
      })
      
      result.push(obj)
      currentLine++
    }
    
    return result
  }
  
  function parseObject(indent: number): any {
    const obj: any = {}
    
    while (currentLine < lines.length) {
      const line = lines[currentLine]
      const lineIndent = line.length - line.trimStart().length
      
      if (line.trim() === '') {
        currentLine++
        continue
      }
      
      if (lineIndent < indent) break
      
      const result = parseLine()
      if (result && typeof result === 'object') {
        Object.assign(obj, result)
      }
    }
    
    return obj
  }
  
  // Start parsing
  const result: any = {}
  while (currentLine < lines.length) {
    const parsed = parseLine()
    if (parsed && typeof parsed === 'object') {
      Object.assign(result, parsed)
    }
  }
  
  return result
}

export default { decode }
