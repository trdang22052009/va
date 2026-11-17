import type { AISolution, ExamType, Question } from '../types';

// Render serves both the UI and API, so an empty base URL means same-origin requests.
const API_URL = ((import.meta.env.VITE_AI_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const CODE_KEY = 'onthi-ai-access-code-v1';

export function getSavedAccessCode(): string {
  return localStorage.getItem(CODE_KEY) ?? '';
}

export function saveAccessCode(code: string): void {
  localStorage.setItem(CODE_KEY, code.trim());
}

export function getAiApiUrl(): string {
  return API_URL;
}

async function callAi<T>(path: string, payload: unknown): Promise<T> {
  const accessCode = getSavedAccessCode();
  if (!accessCode) throw new Error('Bạn chưa nhập mã truy cập AI trong mục Cài đặt & AI.');

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Access-Code': accessCode },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('Máy chủ AI phản hồi quá lâu. Hãy thử lại với ít câu hơn hoặc kiểm tra Render Logs.');
    }
    throw new Error('Không kết nối được máy chủ Render. Hãy kiểm tra website còn hoạt động không.');
  }

  const raw = await response.text();
  let data: ({ error?: string; provider?: string; model?: string } & T) | Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { data = { error: raw.slice(0, 300) || 'Máy chủ trả về phản hồi không hợp lệ.' }; }
  if (!response.ok) {
    const message = 'error' in data && typeof data.error === 'string' ? data.error : `Máy chủ AI trả về lỗi HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export async function testAiConnection(accessCode?: string, provider: 'auto' | 'gemini' | 'cloudflare' = 'auto'): Promise<{ provider: string; model: string; message: string }> {
  if (accessCode?.trim()) saveAccessCode(accessCode);
  return callAi('/api/test-ai', { provider }) as Promise<{ provider: string; model: string; message: string }>;
}

export async function parseWithAi(text: string, examType: ExamType, subject = ''): Promise<Question[]> {
  const result = await callAi<{ questions: Question[]; provider?: string; model?: string }>('/api/parse', { text, examType, subject });
  if (!Array.isArray(result.questions)) throw new Error('AI không trả về danh sách câu hỏi hợp lệ.');
  return result.questions.map((question, index) => {
    const parsedType: Question['type'] = ['multiple', 'short', 'truefalse', 'dragdrop', 'essay'].includes(question.type) ? question.type : 'single';
    return {
      ...question,
      id: question.id || `ai-${Date.now()}-${index}`,
      number: Number(question.number) || index + 1,
      prompt: String(question.prompt ?? '').trim(),
      options: Array.isArray(question.options) ? question.options : [],
      statements: Array.isArray(question.statements) ? question.statements : [],
      section: String(question.section ?? '').trim(),
      subject: String(question.subject ?? subject).trim(),
      type: parsedType,
      answer: typeof question.answer === 'string' && question.answer.trim() ? question.answer.trim().toUpperCase() : null,
    };
  }).filter((question) => question.prompt.length > 0);
}

export async function explainWithAi(question: Question, examType: ExamType, studentQuestion?: string, studentAnswer?: string): Promise<AISolution> {
  return callAi<AISolution>('/api/explain', { question, examType, studentQuestion: studentQuestion ?? '', studentAnswer: studentAnswer ?? '' });
}

export type BulkAiSolution = AISolution & { questionId: string };

export async function solveAllWithAi(
  questions: Question[],
  examType: ExamType,
  onProgress?: (completed: number, total: number, batch: Record<string, AISolution>) => void,
): Promise<Record<string, AISolution>> {
  const pending = questions.filter((question) => !question.aiAnswer && !question.aiExplanation);
  const total = pending.length;
  const collected: Record<string, AISolution> = {};
  const batchSize = 3;

  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize);
    const result = await callAi<{ solutions: BulkAiSolution[]; provider?: string; model?: string }>('/api/solve-batch', {
      examType,
      questions: batch.map((question) => ({
        id: question.id,
        number: question.number,
        prompt: question.prompt,
        options: question.options,
        statements: question.statements ?? [],
        type: question.type,
        subject: question.subject ?? '',
        section: question.section ?? '',
        providedAnswer: question.answer,
        providedExplanation: question.explanation ?? '',
      })),
    });

    if (!Array.isArray(result.solutions)) throw new Error('AI không trả về danh sách lời giải hợp lệ.');
    const batchSolutions: Record<string, AISolution> = {};
    for (const item of result.solutions) {
      if (!item || typeof item.questionId !== 'string') continue;
      const solution: AISolution = {
        answer: String(item.answer ?? '').trim(),
        explanation: String(item.explanation ?? '').trim(),
        confidence: item.confidence === 'high' || item.confidence === 'low' ? item.confidence : 'medium',
        provider: item.provider || result.provider,
        model: item.model || result.model,
      };
      if (solution.answer || solution.explanation) {
        batchSolutions[item.questionId] = solution;
        collected[item.questionId] = solution;
      }
    }
    onProgress?.(Math.min(start + batch.length, total), total, batchSolutions);
  }
  return collected;
}
