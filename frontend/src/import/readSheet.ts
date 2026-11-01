// Reading a player list file into Sheets. CSV is parsed here (no dependency);
// Excel / LibreOffice files use SheetJS, loaded only when such a file is opened.

import { parseCsv, toSheet } from './playerImport'
import type { Sheet } from './playerImport'

export const ACCEPTED_FILES = '.csv,.tsv,.txt,.xlsx,.xls,.ods'

/** UTF-8 first; Excel "CSV" exports on Windows are often Windows-1252. */
async function decodeText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

export async function readSheets(file: File): Promise<Sheet[]> {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = await decodeText(file)
    const sheet = toSheet(file.name, parseCsv(text, ext === 'tsv' ? '\t' : undefined))
    return sheet ? [sheet] : []
  }
  if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'ods') {
    throw new Error(`Format non pris en charge : « ${file.name} ». Utilisez un fichier CSV, XLSX ou ODS.`)
  }
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheets: Sheet[] = []
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    if (!ws || !ws['!ref']) continue
    const start = XLSX.utils.decode_range(ws['!ref']).s.r
    // numbers stay numbers (no "1,850"), everything else as displayed
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      rawNumbers: true,
      defval: '',
      blankrows: true,
    })
    const sheet = toSheet(name, grid, start + 1)
    if (sheet) sheets.push(sheet)
  }
  return sheets
}
