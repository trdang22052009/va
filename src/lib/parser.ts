import type { Question, QuestionOption } from '../types';

const QUESTION_START = /^\s*(?:Câu|Question)\s*(\d{1,3})\s*[\.:)\-]?\s*/i;
const NUMBERED_START = /^\s*(\d{1,3})[\.)]\s+/;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitQuestionBlock(block: string, number: number): Question | null {
  const optionMarker = /(?:^|\n|\s)([A-D])\s*[\).:]\s*/gim;
  const markers: Array<{ label: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = optionMarker.exec(block)) !== null) {
    markers.push({ label: match[1].toUpperCase(), start: match.index, end: optionMarker.lastIndex });
  }

  // Ignore repeated label collisions and only interpret as multiple choice if at least two labels exist.
  const unique = markers.filter((marker, index) => index === 0 || marker.label !== markers[index - 1].label);
  const hasChoices = unique.length >= 2;
  const first = hasChoices ? unique[0].start : block.length;
  const prompt = cleanText(block.slice(0, first));
  if (!prompt) return null;

  const options: QuestionOption[] = [];
  if (hasChoices) {
    unique.forEach((marker, index) => {
      const next = unique[index + 1];
      const raw = block.slice(marker.end, next ? next.start : block.length);
      const text = cleanText(raw.replace(/\n/g, ' '));
      if (text) options.push({ label: marker.label, text });
    });
  }

  if (options.length < 2) return null;
  const uniqueOptions = options.filter((option, index, arr) =>
    arr.findIndex((candidate) => candidate.label === option.label) === index,
  );
  const promptClean = prompt.replace(/^\s*(?:Câu|Question)\s*\d{1,3}\s*[\.:)\-]?\s*/i, '').trim();
  if (!promptClean) return null;

  const isMultiple = /chọn\s*(?:tất cả|các|nhiều)|có thể có nhiều đáp án/i.test(promptClean);
  return {
    id: makeId(),
    number,
    prompt: promptClean,
    options: uniqueOptions,
    type: isMultiple ? 'multiple' : 'single',
    answer: null,
  };
}

export function parseQuestionsFromText(rawText: string): Question[] {
  const text = cleanText(rawText.replace(/\r/g, '\n'));
  const lines = text.split('\n');
  const blocks: Array<{ number: number; content: string }> = [];
  let current: { number: number; content: string } | null = null;
  let implicitNumber = 1;

  for (const line of lines) {
    const questionMatch = line.match(QUESTION_START);
    const numberedMatch = !questionMatch ? line.match(NUMBERED_START) : null;
    const startMatch = questionMatch ?? numberedMatch;
    if (startMatch) {
      if (current && current.content.trim()) blocks.push(current);
      current = {
        number: Number(startMatch[1]) || implicitNumber,
        content: line.replace(startMatch[0], '').trim(),
      };
      implicitNumber = current.number + 1;
    } else if (current) {
      current.content += `\n${line}`;
    }
  }
  if (current && current.content.trim()) blocks.push(current);

  // Some PDFs put everything into one line. Retry by splitting at inline "Câu n" markers.
  if (blocks.length < 2 && text.match(/Câu\s+\d+/gi)?.length) {
    const inline = text.split(/(?=Câu\s+\d{1,3}\s*[\.:)])/gi);
    for (const part of inline) {
      const match = part.match(QUESTION_START);
      if (match) {
        blocks.push({
          number: Number(match[1]),
          content: part.replace(QUESTION_START, '').trim(),
        });
      }
    }
  }

  return blocks
    .map((block) => splitQuestionBlock(block.content, block.number))
    .filter((question): question is Question => Boolean(question));
}

export function makeSampleQuestions(): Question[] {
  return [
    {
      id: makeId(), number: 1,
      prompt: 'Một thiết bị tiêu thụ công suất không đổi 120 W trong 5 phút. Điện năng thiết bị sử dụng là bao nhiêu?',
      options: [
        { label: 'A', text: '600 J' },
        { label: 'B', text: '3 600 J' },
        { label: 'C', text: '36 000 J' },
        { label: 'D', text: '60 000 J' },
      ], type: 'single', answer: 'C', subject: 'Vật lý',
      explanation: 'Đổi 5 phút = 300 giây. Điện năng A = P × t = 120 × 300 = 36 000 J.',
    },
    {
      id: makeId(), number: 2,
      prompt: 'Một nhóm học sinh khảo sát mối liên hệ giữa chiều dài dây dẫn và điện trở, giữ nguyên vật liệu và tiết diện dây. Khi chiều dài dây tăng gấp đôi, điện trở thay đổi thế nào?',
      options: [
        { label: 'A', text: 'Giảm một nửa' },
        { label: 'B', text: 'Không thay đổi' },
        { label: 'C', text: 'Tăng gấp đôi' },
        { label: 'D', text: 'Tăng gấp bốn' },
      ], type: 'single', answer: 'C', subject: 'Vật lý',
      explanation: 'Với cùng vật liệu và tiết diện, R = ρl/S nên điện trở tỉ lệ thuận với chiều dài dây.',
    },
    {
      id: makeId(), number: 3,
      prompt: 'Dữ liệu nào cần được giữ cố định để khảo sát riêng ảnh hưởng của chiều dài dây dẫn đến điện trở?',
      options: [
        { label: 'A', text: 'Vật liệu dây' },
        { label: 'B', text: 'Tiết diện dây' },
        { label: 'C', text: 'Chiều dài dây' },
        { label: 'D', text: 'Cả vật liệu và tiết diện dây' },
      ], type: 'multiple', answer: 'A,D', subject: 'Khoa học',
      explanation: 'Muốn khảo sát riêng ảnh hưởng của chiều dài, cần giữ các yếu tố khác như vật liệu và tiết diện không đổi.',
    },
  ];
}
