import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPdf {
  text: string;
  pages: number;
  characters: number;
}

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Vui lòng chọn tệp PDF.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('Tệp lớn hơn 30 MB. Hãy dùng bản PDF nhẹ hơn.');
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => 'str' in item) as Array<{
      str: string;
      transform: number[];
      hasEOL?: boolean;
    }>;

    // Group PDF text fragments by vertical coordinate to preserve readable lines.
    const rows = new Map<number, Array<{ x: number; text: string; eol: boolean }>>();
    for (const item of items) {
      const y = Math.round(item.transform[5] / 2) * 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], text: item.str, eol: Boolean(item.hasEOL) });
      rows.set(y, row);
    }

    const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    const lines = sortedRows.map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(' ')
        .replace(/[\t ]+/g, ' ')
        .trim(),
    );
    pageTexts.push(`\n--- Trang ${pageNo} ---\n${lines.filter(Boolean).join('\n')}`);
  }

  const text = pageTexts.join('\n');
  return { text, pages: pdf.numPages, characters: text.length };
}
