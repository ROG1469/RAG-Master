export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    console.log('[PDF Parser] Parsing PDF, buffer size:', buffer.length)
    // Use pdf-parse
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text
    console.log('[PDF Parser] Successfully extracted', text.length, 'characters')

    if (!text || text.trim().length === 0) {
      throw new Error('PDF contains no text (might be scanned images)')
    }

    return text
  } catch (error) {
    console.error('[PDF Parser] Error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`)
    }
    throw new Error('Failed to parse PDF file')
  }
}
