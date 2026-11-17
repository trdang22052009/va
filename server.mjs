import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const ROOT = resolve('dist');
const PORT = Number(process.env.PORT || 10000);
const MAX_TEXT_CHARS = 160000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Confirmed in the current Cloudflare Workers AI model catalogue.
const CF_MODEL = process.env.CLOUDFLARE_AI_MODEL || '@cf/google/gemma-4-26b-a4b-it';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error('Yêu cầu quá lớn. Hãy chia đề PDF thành các phần nhỏ.'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Dữ liệu JSON không hợp lệ.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function parseModelJson(text) {
  const clean = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch {
    const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('AI trả về nội dung không đúng định dạng JSON. Hãy thử lại với phần đề ngắn hơn.');
  }
}

function splitTextIntoChunks(text, chunkSize) {
  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + chunkSize, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end);
      if (newline > offset + Math.floor(chunkSize * 0.72)) end = newline + 1;
    }
    if (end <= offset) end = Math.min(offset + chunkSize, text.length);
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

function providerError(provider, status, message) {
  const mapped = status === 429 ? 429 : status === 401 || status === 403 ? 502 : status === 404 ? 502 : status >= 500 ? 503 : 502;
  const error = new Error(`${provider}: ${message}`);
  error.status = mapped; error.provider = provider; error.providerStatus = status;
  return error;
}

async function fetchWithRetry(url, options, provider) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
      const raw = await response.text();
      let data = {}; try { data = JSON.parse(raw); } catch { /* provider may return plain text */ }
      if (!response.ok) {
        let detail = data?.error?.message || data?.errors?.[0]?.message || data?.message || raw.slice(0, 500) || `HTTP ${response.status}`;
        if (provider === 'Cloudflare Workers AI' && (response.status === 401 || response.status === 403)) detail += ' | Kiểm tra Account ID và API Token. Nếu tự tạo token thủ công, cấp quyền Workers AI Read và Workers AI Edit; hoặc tạo token theo mẫu Workers AI API trong dashboard.';
        if (provider === 'Cloudflare Workers AI' && response.status === 404) detail += ' | Kiểm tra CLOUDFLARE_AI_MODEL có đúng Model ID trong danh mục Workers AI không.';
        const error = providerError(provider, response.status, detail);
        // Retry transient errors only; authentication, model and request errors should fail fast.
        if (attempt === 0 && [408, 500, 502, 503, 504].includes(response.status)) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
          lastError = error; continue;
        }
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        lastError = providerError(provider, 504, 'Hết thời gian chờ phản hồi.');
        if (attempt === 0) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 800)); continue; }
      } else if (error?.provider) throw error;
      else lastError = providerError(provider, 0, error instanceof Error ? error.message : 'Không kết nối được nhà cung cấp AI.');
    }
  }
  throw lastError || providerError(provider, 503, 'Nhà cung cấp AI tạm thời không phản hồi.');
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
}

function extractCloudflareText(data) {
  return data?.result?.response || data?.result?.choices?.[0]?.message?.content || data?.response || '';
}

async function runGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw providerError('Gemini', 0, 'Chưa cấu hình GEMINI_API_KEY.');
  const data = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Gemini 3.x no longer accepts temperature/top_p/top_k in generationConfig.
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      }),
    },
    'Gemini',
  );
  const text = extractGeminiText(data);
  if (!text) throw providerError('Gemini', 502, 'Không nhận được nội dung. Kiểm tra hạn mức API hoặc thử lại.');
  return { json: parseModelJson(text), provider: 'Gemini', model: GEMINI_MODEL };
}

async function runCloudflare(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw providerError('Cloudflare Workers AI', 0, 'Chưa cấu hình CLOUDFLARE_ACCOUNT_ID và CLOUDFLARE_API_TOKEN.');
  const data = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Bạn là gia sư luyện thi Việt Nam. Trả về đúng JSON hợp lệ theo yêu cầu, không thêm markdown hoặc văn bản ngoài JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 8192,
      }),
    },
    'Cloudflare Workers AI',
  );
  if (data?.success === false) {
    const detail = data?.errors?.map((item) => item.message || item.code).filter(Boolean).join('; ') || 'Cloudflare từ chối yêu cầu.';
    throw providerError('Cloudflare Workers AI', 502, detail);
  }
  const text = extractCloudflareText(data);
  if (!text) throw providerError('Cloudflare Workers AI', 502, 'Model không trả về nội dung. Kiểm tra token quyền Workers AI – Read, model và hạn mức Neurons.');
  return { json: parseModelJson(text), provider: 'Cloudflare Workers AI', model: CF_MODEL };
}

async function runAi(prompt) {
  const attempts = [];
  // Gemini is preferred; Cloudflare Workers AI is used when Gemini is not configured or unavailable.
  if (process.env.GEMINI_API_KEY) {
    try { return await runGemini(prompt); }
    catch (error) { attempts.push(error); }
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    try { return await runCloudflare(prompt); }
    catch (error) { attempts.push(error); }
  }
  const detail = attempts.map((error) => error instanceof Error ? error.message : String(error)).join(' | ');
  const missing = [];
  if (!process.env.GEMINI_API_KEY) missing.push('thiếu GEMINI_API_KEY');
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) missing.push('thiếu CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN nên không có AI dự phòng');
  const suffix = missing.length ? ` Cấu hình Render Environment: ${missing.join('; ')}.` : '';
  const status = attempts.some((error) => error?.status === 429) ? 429 : attempts.some((error) => error?.status === 503) ? 503 : 502;
  throw Object.assign(new Error((detail || 'Chưa cấu hình nhà cung cấp AI.') + suffix), { status });
}

function importPrompt(text, examType, subject = '') {
  return `Bạn là hệ thống số hóa đề thi tiếng Việt. Hãy chuyển văn bản PDF thành danh sách câu hỏi có thể làm trên máy tính.
Loại đề: ${examType}. Môn (nếu có): ${subject || 'Không xác định'}.

QUY TẮC:
- Giữ nguyên đề bài, số liệu, đơn vị, biểu thức, phương án; không tự sửa dữ kiện.
- Nhận diện câu hỏi một lựa chọn (single), nhiều lựa chọn (multiple), điền ngắn (short), dạng Đúng/Sai có các mệnh đề (truefalse), kéo-thả/chọn trong menu (dragdrop), hoặc tự luận (essay).
- Với truefalse, tạo statements [{"label":"a","text":"..."}] và answer dạng "a=Đ,b=S,c=Đ,d=S" chỉ khi đáp án gốc xuất hiện rõ ràng; nếu không thì answer=null.
- Gán section theo đúng phần trong đề khi nhận diện được. TSA dùng một trong: "Tư duy Toán học", "Tư duy Đọc hiểu", "Tư duy Khoa học/Giải quyết vấn đề". HSA dùng một trong: "Toán học và xử lý số liệu", "Văn học - Ngôn ngữ", "Khoa học hoặc Tiếng Anh". THPT dùng tên môn hoặc phần (nếu nhận diện được). Nếu không rõ, để section="".
- type chỉ nhận single, multiple, short, truefalse, dragdrop, essay. Với dragdrop, options chứa các thẻ/giá trị để chọn và answer là nhãn đúng. Với bài tự luận, giữ nguyên yêu cầu và phần dẫn; không giả lập đáp án chấm điểm.
- answer chỉ lấy từ đáp án/lời giải gốc hiện rõ trong PDF. Không tự đoán hoặc tự giải để điền đáp án.
- explanation chỉ điền nếu văn bản có lời giải gốc; nếu không để rỗng.
- Bỏ qua tiêu đề, số trang và hướng dẫn chung. Giữ số câu và thứ tự gốc. Nếu đoạn văn bắt đầu hoặc kết thúc giữa một câu, không tự tạo câu cụt; chỉ trả những câu đủ nội dung.
- Nếu câu phụ thuộc hình/biểu đồ nhưng văn bản không mô tả, ghi rõ [Cần kiểm tra hình/biểu đồ trong PDF] trong prompt; tuyệt đối không bịa nội dung hình.
- Chỉ trả JSON hợp lệ theo schema: {"questions":[{"number":1,"prompt":"...","options":[{"label":"A","text":"..."}],"statements":[{"label":"a","text":"..."}],"type":"single","answer":null,"explanation":"","subject":"","section":""}]}

VĂN BẢN PDF:
${text}`;
}

function solveBatchPrompt(questions, examType) {
  const normalizedQuestions = questions.map((question) => ({ ...question, questionId: question.id }));
  return `Bạn là gia sư luyện thi ${examType}, giải độc lập từng câu và trả lời tiếng Việt.
- Chỉ dùng dữ kiện trong câu hỏi. Không tự bịa hình, bảng, đoạn dẫn hay giả định.
- Câu thiếu hình/biểu đồ/dữ kiện: answer="", confidence="low", giải thích rõ cần xem bản gốc.
- Single: answer là nhãn A/B/C/D. Multiple: nhãn ngăn bằng dấu phẩy. Dragdrop: answer là nhãn của thẻ/giá trị. Short: kết quả ngắn có đơn vị. Truefalse: định dạng "a=Đ,b=S,c=Đ,d=S". Essay: cung cấp dàn ý, luận điểm và tiêu chí tự đối chiếu; không tự cho điểm chính thức.
- Tính toán tự kiểm tra; giải theo bước ngắn, nêu công thức khi phù hợp.
- Nếu có đáp án gốc, hãy tự giải trước rồi đối chiếu; nêu rõ bất đồng.
- confidence chỉ high, medium, low. Không suy diễn độ chắc chắn quá mức.
- Trả đủ một phần tử cho mỗi questionId trong đúng JSON, không có văn bản ngoài JSON.
Schema: {"solutions":[{"questionId":"id","answer":"B","explanation":"...","confidence":"high|medium|low"}]}
CÂU HỎI: ${JSON.stringify(normalizedQuestions)}`;
}

function explainPrompt(question, examType, studentQuestion, studentAnswer) {
  return `Bạn là gia sư luyện thi ${examType}, giải thích bằng tiếng Việt cho học sinh THPT.
Câu hỏi: ${question.prompt}
Dạng: ${question.type}
Lựa chọn: ${JSON.stringify(question.options || [])}
Mệnh đề đúng/sai: ${JSON.stringify(question.statements || [])}
Đáp án gốc nếu có: ${question.answer || 'Không có'}
Lời giải gốc nếu có: ${question.explanation || 'Không có'}
Bài làm của học sinh (nếu có): ${question.type === 'essay' ? (studentAnswer || 'Chưa nộp bài làm') : 'Không áp dụng'}
Câu hỏi thêm: ${studentQuestion || (question.type === 'essay' ? 'Nhận xét bài làm theo tiêu chí: bám đề, lập luận, dẫn chứng, diễn đạt; nêu điểm mạnh và cách cải thiện. Không tự nhận đây là điểm chính thức.' : 'Hãy giải thích cách làm và cách loại trừ phương án sai.')}
Tự giải độc lập, kiểm tra dữ kiện và phép tính. Nếu đề thiếu hình, bảng hoặc dữ kiện, nói rõ không đủ thông tin. Đừng tự nhận câu trả lời của AI là đáp án chính thức.
Chỉ trả về JSON: {"answer":"B","explanation":"...","confidence":"high|medium|low"}`;
}

function providerStatus() {
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const cloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  return {
    ok: true,
    aiConfigured: gemini || cloudflare,
    providers: {
      gemini: { configured: gemini, model: GEMINI_MODEL, role: 'primary' },
      cloudflare: { configured: cloudflare, model: CF_MODEL, role: gemini ? 'fallback' : 'primary' },
    },
    message: gemini && cloudflare ? 'Đã khai báo Gemini và Cloudflare Workers AI. Hãy kiểm tra thực tế từng nhà cung cấp.' : gemini ? 'Đã khai báo Gemini; chưa có Cloudflare dự phòng.' : cloudflare ? 'Đã khai báo Cloudflare Workers AI; chưa có Gemini.' : 'Chưa cấu hình nhà cung cấp AI.',
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, providerStatus());
  const endpoints = ['/api/parse', '/api/explain', '/api/solve-batch', '/api/test-ai'];
  if (req.method !== 'POST' || !endpoints.includes(url.pathname)) return sendJson(res, 404, { error: 'Không tìm thấy endpoint.' });

  const expectedCode = process.env.APP_ACCESS_CODE;
  if (!expectedCode) return sendJson(res, 503, { error: 'Máy chủ chưa cấu hình APP_ACCESS_CODE trong Render Environment.' });
  if (req.headers['x-app-access-code'] !== expectedCode) return sendJson(res, 401, { error: 'Mã truy cập AI không đúng. Hãy kiểm tra APP_ACCESS_CODE trên Render và nhập lại trong Cài đặt & AI.' });

  try {
    const body = await readJson(req);
    if (url.pathname === '/api/test-ai') {
      const provider = String(body.provider || 'auto').toLowerCase();
      const probePrompt = 'Trả về JSON hợp lệ theo schema {"ok":true,"message":"Kết nối thành công"}. Chỉ trả JSON.';
      let result;
      if (provider === 'gemini') result = await runGemini(probePrompt);
      else if (provider === 'cloudflare') result = await runCloudflare(probePrompt);
      else result = await runAi(probePrompt);
      return sendJson(res, 200, { ok: true, provider: result.provider, model: result.model, message: result.json.message || 'Kết nối thành công.' });
    }
    if (url.pathname === '/api/parse') {
      const text = String(body.text || '').trim();
      const examType = String(body.examType || 'TSA');
      if (!text) return sendJson(res, 400, { error: 'Không có văn bản PDF để phân tích.' });
      if (text.length > MAX_TEXT_CHARS) return sendJson(res, 413, { error: `Văn bản đề dài hơn ${MAX_TEXT_CHARS.toLocaleString('vi-VN')} ký tự. Hãy chia PDF thành phần nhỏ.` });
      // Chunk the extracted text so the free Cloudflare fallback stays within smaller context windows.
      const chunkSize = 18000;
      const chunks = splitTextIntoChunks(text, chunkSize);
      const allQuestions = [];
      const usedProviders = new Set();
      let usedModel = '';
      for (let index = 0; index < chunks.length; index += 1) {
        const result = await runAi(importPrompt(chunks[index], examType, String(body.subject || '')));
        if (!Array.isArray(result.json.questions)) throw new Error(`${result.provider} không tạo được danh sách câu hỏi ở phần ${index + 1}.`);
        allQuestions.push(...result.json.questions);
        usedProviders.add(result.provider);
        usedModel = result.model;
      }
      const provider = [...usedProviders].join(' + ');
      return sendJson(res, 200, { questions: allQuestions.slice(0, 250), provider, model: usedModel, chunks: chunks.length });
    }
    if (url.pathname === '/api/solve-batch') {
      const questions = Array.isArray(body.questions) ? body.questions : [];
      if (!questions.length) return sendJson(res, 400, { error: 'Chưa có câu hỏi cần giải.' });
      if (questions.length > 5) return sendJson(res, 400, { error: 'Mỗi lượt chỉ xử lý tối đa 5 câu.' });
      if (questions.some((item) => !item || typeof item.id !== 'string' || !String(item.prompt || '').trim())) return sendJson(res, 400, { error: 'Danh sách câu hỏi có dữ liệu không hợp lệ.' });
      const result = await runAi(solveBatchPrompt(questions, String(body.examType || 'TSA')));
      if (!Array.isArray(result.json.solutions)) throw new Error(`${result.provider} không trả về danh sách lời giải.`);
      const byId = new Map(result.json.solutions.filter((item) => item && item.questionId).map((item) => [String(item.questionId), item]));
      const normalizedSolutions = questions.map((question, index) => {
        const item = byId.get(question.id) || result.json.solutions[index];
        if (!item) return null;
        return {
          questionId: question.id,
          answer: String(item.answer ?? '').trim(),
          explanation: String(item.explanation ?? '').trim(),
          confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
        };
      });
      if (normalizedSolutions.some((item) => !item)) throw new Error(`${result.provider} chỉ giải được ${normalizedSolutions.filter(Boolean).length}/${questions.length} câu trong nhóm. Hãy bấm giải lại để thử phần còn thiếu.`);
      return sendJson(res, 200, { solutions: normalizedSolutions, provider: result.provider, model: result.model });
    }
    const question = body.question || {};
    if (!question.prompt) return sendJson(res, 400, { error: 'Thiếu nội dung câu hỏi.' });
    const result = await runAi(explainPrompt(question, String(body.examType || 'TSA'), String(body.studentQuestion || ''), String(body.studentAnswer || '')));
    return sendJson(res, 200, { answer: String(result.json.answer ?? '').trim(), explanation: String(result.json.explanation ?? '').trim(), confidence: String(result.json.confidence ?? 'medium'), provider: result.provider, model: result.model });
  } catch (error) {
    const status = Number(error?.status) || 502;
    return sendJson(res, status, { error: error instanceof Error ? error.message : 'Lỗi không xác định khi gọi AI.' });
  }
}

async function serveStatic(req, res, url) {
  let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { pathname = '/'; }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = resolve(ROOT, relative);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  try { const info = await stat(filePath); if (!info.isFile()) throw new Error('Not a file'); }
  catch { filePath = resolve(ROOT, 'index.html'); }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Chưa tìm thấy thư mục dist. Hãy chạy npm run build trước.'); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  return serveStatic(req, res, url);
});
server.listen(PORT, '0.0.0.0', () => console.log(`Ôn Thi AI v0.4.2 đang chạy tại cổng ${PORT}`));
