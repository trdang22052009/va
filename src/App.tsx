import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CloudUpload,
  FileCheck2, FileQuestion, FileText, Flag, FolderOpen, GraduationCap, Home,
  Lightbulb, LoaderCircle, LockKeyhole, Menu, MessageCircle,
  Plus, RefreshCw, Save, Settings, ShieldCheck, Sparkles, Target, Timer,
  Trash2, Upload, X, Zap,
} from 'lucide-react';
import type { AISolution, Attempt, Exam, ExamType, Question } from './types';
import { extractPdfText } from './lib/pdf';
import { makeSampleQuestions, parseQuestionsFromText } from './lib/parser';
import { loadAttempts, loadExams, saveAttempt, saveExams } from './lib/storage';
import { explainWithAi, getAiApiUrl, getSavedAccessCode, parseWithAi, saveAccessCode, solveAllWithAi, testAiConnection } from './lib/ai';
import { getExamSections, getQuestionSectionName, getSuggestedDuration } from './lib/exam-structure';

 type Page = 'dashboard' | 'upload' | 'library' | 'settings';

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function examTypeLabel(type: ExamType) {
  return type === 'THPT' ? 'THPT' : type;
}

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [exams, setExams] = useState<Exam[]>(() => loadExams());
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts());
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [quizDuration, setQuizDuration] = useState(60);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [settingsCode, setSettingsCode] = useState(getSavedAccessCode());

  useEffect(() => {
    if (exams.length === 0) {
      const demo: Exam = {
        id: newId(), title: 'Bài làm quen tư duy khoa học', examType: 'TSA',
        fileName: 'Bài mẫu có sẵn', createdAt: new Date().toISOString(),
        questions: makeSampleQuestions(),
      };
      setExams([demo]);
    }
  }, []);

  useEffect(() => saveExams(exams), [exams]);

  const totalQuestions = exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => { const graded = attempt.graded ?? attempt.total; return sum + (attempt.accuracy ?? (graded ? (attempt.correct / graded) * 100 : 0)); }, 0) / attempts.length)
    : 0;

  function startExam(exam: Exam, duration = getSuggestedDuration(exam)) {
    setActiveExam(exam);
    setQuizDuration(duration);
  }

  function finishAttempt(attempt: Attempt) {
    saveAttempt(attempt);
    setAttempts(loadAttempts());
  }

  function updateExam(updatedExam: Exam) {
    setExams((current) => current.map((item) => item.id === updatedExam.id ? updatedExam : item));
    setActiveExam(updatedExam);
  }

  function deleteExam(id: string) {
    if (!window.confirm('Xóa đề này khỏi thư viện trên trình duyệt?')) return;
    setExams((current) => current.filter((exam) => exam.id !== id));
    setNotice('Đã xóa đề khỏi thư viện.');
  }

  function changePage(next: Page) {
    setPage(next);
    setActiveExam(null);
    setMobileMenu(false);
  }

  if (activeExam) {
    return <QuizView exam={activeExam} duration={quizDuration} onBack={() => setActiveExam(null)} onFinish={finishAttempt} onUpdateExam={updateExam} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><GraduationCap size={23} /></div>
          <div><div className="brand-name">Ôn Thi <span>AI</span></div><div className="brand-caption">TSA · HSA · THPT</div></div>
          <button className="icon-btn sidebar-close" aria-label="Đóng menu" onClick={() => setMobileMenu(false)}><X size={18}/></button>
        </div>
        <div className="workspace-pill"><div className="workspace-avatar">M</div><div><b>Không gian cá nhân</b><small>Chỉ lưu trên thiết bị này</small></div><ChevronDown size={15}/></div>
        <div className="nav-label">KHÔNG GIAN HỌC TẬP</div>
        <nav className="main-nav">
          <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => changePage('dashboard')}><Home size={18}/><span>Tổng quan</span></button>
          <button className={page === 'upload' ? 'nav-item active' : 'nav-item'} onClick={() => changePage('upload')}><CloudUpload size={18}/><span>Tải đề PDF</span><span className="nav-new">Mới</span></button>
          <button className={page === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => changePage('library')}><FolderOpen size={18}/><span>Thư viện đề</span><span className="nav-count">{exams.length}</span></button>
          <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => changePage('settings')}><Settings size={18}/><span>Cài đặt & AI</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Sparkles size={18}/></div>
          <b>Học thông minh hơn</b>
          <p>Tải đề của bạn lên, biến PDF thành bài thi và nhờ AI giải thích câu khó.</p>
          <button onClick={() => changePage('upload')}>Tạo bài thi <ArrowRight size={14}/></button>
        </div>
        <div className="sidebar-foot"><ShieldCheck size={15}/> Dữ liệu đề lưu trên trình duyệt</div>
      </aside>
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Đóng menu"/>}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="Mở menu"><Menu size={20}/></button>
          <div className="breadcrumb">Không gian cá nhân <ChevronRight size={14}/><b>{page === 'dashboard' ? 'Tổng quan' : page === 'upload' ? 'Tải đề PDF' : page === 'library' ? 'Thư viện đề' : 'Cài đặt & AI'}</b></div>
          <div className="topbar-right"><span className="local-status"><span/> Hoạt động ngoại tuyến</span><div className="profile-chip"><div className="profile-avatar">M</div><span>Của tôi</span></div></div>
        </header>
        {notice && <div className="notice-bar"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}

        {page === 'dashboard' && (
          <Dashboard exams={exams} attempts={attempts} totalQuestions={totalQuestions} average={average} onNavigate={changePage} onStart={startExam} onDelete={deleteExam} />
        )}
        {page === 'upload' && <UploadPage onSave={(exam) => { setExams((current) => [exam, ...current]); setPage('library'); setNotice(`Đã thêm “${exam.title}” vào thư viện.`); }} />}
        {page === 'library' && <LibraryPage exams={exams} onStart={startExam} onDelete={deleteExam} onNavigate={changePage} />}
        {page === 'settings' && <SettingsPage code={settingsCode} setCode={setSettingsCode} />}
        <footer className="main-footer"><span>Ôn Thi AI <span className="footer-dot">·</span> Phòng thi AI v0.4.2</span><span>Đề và lịch sử làm bài được lưu cục bộ trên thiết bị</span></footer>
      </main>
    </div>
  );
}

function Dashboard({ exams, attempts, totalQuestions, average, onNavigate, onStart, onDelete }: {
  exams: Exam[]; attempts: Attempt[]; totalQuestions: number; average: number;
  onNavigate: (page: Page) => void; onStart: (exam: Exam, duration?: number) => void; onDelete: (id: string) => void;
}) {
  const recent = attempts.slice(0, 4);
  return (
    <div className="page-content">
      <section className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-dot"/> KHÔNG GIAN LUYỆN THI CỦA BẠN</div><h1>Chào bạn, sẵn sàng <span>bứt phá?</span></h1><p>Tập trung đúng trọng tâm. Luyện tập có chiến lược. Tiến bộ qua từng đề.</p></div>
        <div className="welcome-decoration"><div className="decoration-ring ring-one"/><div className="decoration-ring ring-two"/><div className="decoration-icon"><BrainCircuit size={37}/></div><span className="float-dot dot-a"/><span className="float-dot dot-b"/><span className="float-dot dot-c"/></div>
      </section>

      <section className="stats-grid">
        <StatCard icon={<FileText size={18}/>} label="Bộ đề đã lưu" value={String(exams.length)} note="Trong thư viện cá nhân" tone="blue" />
        <StatCard icon={<FileQuestion size={18}/>} label="Tổng số câu hỏi" value={String(totalQuestions)} note="Từ các đề đã tải" tone="violet" />
        <StatCard icon={<Activity size={18}/>} label="Lượt luyện tập" value={String(attempts.length)} note="Bài thi đã hoàn thành" tone="green" />
        <StatCard icon={<Target size={18}/>} label="Tỷ lệ đúng trung bình" value={`${average}%`} note="Tính trên câu có đáp án" tone="orange" />
      </section>

      <section className="content-grid">
        <div className="panel main-panel">
          <div className="section-heading"><div><h2>Bắt đầu luyện tập</h2><p>Chọn bộ đề bạn muốn chinh phục hôm nay.</p></div><button className="text-link" onClick={() => onNavigate('library')}>Xem thư viện <ArrowRight size={15}/></button></div>
          {exams.length > 0 ? <div className="exam-card-list">{exams.slice(0, 3).map((exam) => <ExamCard key={exam.id} exam={exam} onStart={() => onStart(exam)} onDelete={() => onDelete(exam.id)} />)}</div> : <EmptyState title="Chưa có bộ đề nào" text="Tải PDF đầu tiên để bắt đầu tạo bài thi." action="Tải đề PDF" onClick={() => onNavigate('upload')}/>}
          {exams.length > 3 && <button className="button-outline full-width" onClick={() => onNavigate('library')}>Xem tất cả bộ đề <ArrowRight size={15}/></button>}
        </div>
        <div className="side-stack">
          <div className="panel quick-panel"><div className="section-heading"><div><h2>Tạo bài thi mới</h2><p>Chỉ mất vài bước để bắt đầu.</p></div><div className="heading-icon"><Plus size={18}/></div></div><div className="quick-steps"><div><span>1</span><p><b>Tải đề PDF</b><small>Chọn đề TSA, HSA hoặc THPT.</small></p></div><div><span>2</span><p><b>Chuyển thành câu hỏi</b><small>Dùng bộ tách tự động hoặc AI.</small></p></div><div><span>3</span><p><b>Bắt đầu làm bài</b><small>Chấm điểm và xem giải thích.</small></p></div></div><button className="button-primary full-width" onClick={() => onNavigate('upload')}><Upload size={16}/> Tải đề lên ngay</button></div>
          <div className="ai-promo"><div className="ai-promo-top"><div className="ai-promo-icon"><Sparkles size={20}/></div><span className="mini-tag">AI STUDY BUDDY</span></div><h3>Đừng chỉ biết đáp án.<br/><span>Hãy hiểu vì sao.</span></h3><p>Nhờ AI phân tích từng bước, chỉ ra dữ kiện quan trọng và cách tư duy cho câu hỏi khó.</p><button onClick={() => onNavigate('settings')}>Thiết lập trợ lý AI <ArrowRight size={15}/></button><div className="promo-orb"/></div>
        </div>
      </section>

      <section className="panel activity-panel"><div className="section-heading"><div><h2>Hoạt động gần đây</h2><p>Theo dõi những lần bạn đã luyện tập.</p></div><span className="subtle-label">4 gần nhất</span></div>
        {recent.length ? <div className="activity-table"><div className="activity-head"><span>BỘ ĐỀ</span><span>NGÀY LÀM</span><span>KẾT QUẢ</span><span>TRẠNG THÁI</span></div>{recent.map((attempt) => <div className="activity-row" key={attempt.id}><span className="activity-exam"><div className="file-mini"><FileText size={15}/></div><b>{attempt.examTitle}</b></span><span>{formatDate(attempt.completedAt)}</span><span><b>{attempt.score !== undefined && attempt.maxScore !== undefined ? `${attempt.score.toFixed(2)}/${attempt.maxScore.toFixed(2)}` : `${attempt.correct}/${attempt.total}`}</b><small>{attempt.score !== undefined ? ' điểm' : ' câu đúng'}</small></span><span><span className="status-pill done"><Check size={12}/> Hoàn thành</span></span></div>)}</div> : <div className="empty-activity"><div className="empty-icon"><Clock3 size={21}/></div><b>Chưa có hoạt động nào</b><p>Bài làm đầu tiên sẽ xuất hiện ở đây.</p></div>}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}

function ExamCard({ exam, onStart, onDelete }: { exam: Exam; onStart: () => void; onDelete: () => void }) {
  return <div className="exam-card"><div className={`exam-cover cover-${exam.examType.toLowerCase()}`}><div className="cover-grid"/><span>{examTypeLabel(exam.examType)}</span><div className="cover-symbol">{exam.examType === 'TSA' ? <BrainCircuit size={29}/> : exam.examType === 'HSA' ? <BookOpen size={29}/> : <GraduationCap size={29}/>}</div></div><div className="exam-info"><div className="exam-meta"><span className={`type-chip type-${exam.examType.toLowerCase()}`}>{exam.examType}</span><span>{formatDate(exam.createdAt)}</span></div><h3>{exam.title}</h3><p><FileQuestion size={14}/>{exam.questions.length} câu hỏi <span className="meta-separator">·</span><FileText size={14}/>{exam.fileName}</p><div className="exam-actions"><button className="button-primary small" onClick={onStart}>Làm bài <ArrowRight size={14}/></button><button className="icon-btn danger-hover" title="Xóa đề" onClick={onDelete}><Trash2 size={16}/></button></div></div></div>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><FolderOpen size={24}/></div><b>{title}</b><p>{text}</p><button className="button-primary small" onClick={onClick}>{action}</button></div>;
}

function UploadPage({ onSave }: { onSave: (exam: Exam) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [examType, setExamType] = useState<ExamType>('TSA');
  const [subject, setSubject] = useState('Toán');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sourceStats, setSourceStats] = useState<{ pages: number; characters: number } | null>(null);

  async function readFile(selected: File) {
    setFile(selected); setTitle(selected.name.replace(/\.pdf$/i, '')); setError(''); setInfo(''); setQuestions([]); setText(''); setSourceStats(null); setIsReading(true);
    try {
      const extracted = await extractPdfText(selected);
      setText(extracted.text);
      setSourceStats({ pages: extracted.pages, characters: extracted.characters });
      const parsed = parseQuestionsFromText(extracted.text);
      setQuestions(parsed);
      if (extracted.characters < 80) {
        setInfo('PDF gần như không có lớp văn bản. Có thể đây là bản scan/ảnh; phiên bản này chưa OCR ảnh, bạn có thể dùng PDF có thể bôi đen/copy chữ hoặc dán văn bản đã nhận diện.');
      } else if (parsed.length > 0) {
        setInfo(`Đã đọc ${extracted.pages} trang và nhận diện sơ bộ ${parsed.length} câu. Hãy kiểm tra lại câu hỏi và lựa chọn trước khi lưu.`);
      } else {
        setInfo('Đã đọc được văn bản nhưng chưa nhận diện ra câu trắc nghiệm. Hãy thử AI hoặc dán văn bản đã trích xuất.');
      }
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Không đọc được tệp PDF.');
    } finally { setIsReading(false); }
  }

  async function runAiParser() {
    if (!text.trim()) { setError('Chưa có văn bản PDF để AI phân tích.'); return; }
    setIsAiParsing(true); setError(''); setInfo('AI đang phân tích cấu trúc đề. Với đề dài, hãy chia PDF thành phần nhỏ.');
    try {
      const wasTruncated = text.length > 160000;
      const result = await parseWithAi(text.slice(0, 160000), examType, subject);
      if (!result.length) throw new Error('AI chưa nhận diện được câu hỏi nào. Hãy thử bộ tách tự động hoặc kiểm tra lại PDF.');
      setQuestions(result);
      setInfo(`AI đã tách được ${result.length} câu. ${result.filter((item) => item.section).length} câu đã được phân phần. Các câu chưa có đáp án gốc sẽ để trống để tránh tự gán đáp án sai.${wasTruncated ? ' PDF dài hơn giới hạn 160.000 ký tự; hãy chia thành nhiều phần nếu còn trang chưa được tách.' : ''}`);
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : 'Không thể gọi AI.');
    } finally { setIsAiParsing(false); }
  }

  function reparseLocally() {
    const parsed = parseQuestionsFromText(text);
    setQuestions(parsed);
    setError('');
    setInfo(parsed.length ? `Bộ tách tự động nhận diện ${parsed.length} câu.` : 'Chưa nhận diện được câu trắc nghiệm. Thử chức năng AI hoặc chỉnh sửa thủ công.');
  }

  function updateQuestion(index: number, patch: Partial<Question>) {
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question));
  }

  function saveExam() {
    if (!title.trim()) { setError('Hãy đặt tên cho bộ đề.'); return; }
    if (!questions.length) { setError('Chưa có câu hỏi nào để lưu.'); return; }
    onSave({ id: newId(), title: title.trim(), examType, subject: examType === 'THPT' ? subject : undefined, fileName: file?.name ?? 'Văn bản đã dán', createdAt: new Date().toISOString(), questions });
  }

  return <div className="page-content narrow-page">
    <div className="page-title-row"><div><div className="eyebrow">TẠO BỘ ĐỀ MỚI</div><h1>Tải đề <span>PDF</span></h1><p>Chuyển đề thi thành bài luyện tập có thể tương tác.</p></div><div className="page-title-icon"><CloudUpload size={27}/></div></div>
    <div className="upload-layout">
      <div className="panel upload-main-panel">
        <div className="panel-title"><div className="step-badge">01</div><div><h2>Chọn tài liệu PDF</h2><p>Chọn đề TSA, HSA hoặc đề thi THPT có sẵn trên máy.</p></div></div>
        <label className={`dropzone ${file ? 'dropzone-loaded' : ''}`}>
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void readFile(selected); }} />
          <div className="dropzone-icon">{isReading ? <LoaderCircle className="spin" size={27}/> : file ? <FileCheck2 size={27}/> : <CloudUpload size={27}/>}</div>
          <b>{isReading ? 'Đang đọc nội dung PDF…' : file ? file.name : 'Kéo thả tệp PDF vào đây'}</b>
          <span>{file ? 'Nhấn để chọn tệp khác' : 'hoặc nhấn để duyệt tệp từ thiết bị'}</span>
          <small>PDF · Tối đa 30 MB</small>
        </label>
        {sourceStats && <div className="file-read-stats"><span><CheckCircle2 size={14}/> Đã đọc PDF</span><span>{sourceStats.pages} trang</span><span>{sourceStats.characters.toLocaleString('vi-VN')} ký tự</span></div>}
        <div className="field-grid">
          <label className="field-label">Loại đề<select value={examType} onChange={(event) => setExamType(event.target.value as ExamType)}><option value="TSA">TSA – Đánh giá tư duy</option><option value="HSA">HSA – Đánh giá năng lực</option><option value="THPT">THPT – Tốt nghiệp THPT</option><option value="Khác">Khác</option></select></label>
          {examType === 'THPT' && <label className="field-label">Môn thi<select value={subject} onChange={(event) => setSubject(event.target.value)}>{['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Giáo dục kinh tế và pháp luật','Tin học','Công nghệ'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
          <label className="field-label">Tên bộ đề<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: TSA - Đề luyện số 01" /></label>
        </div>
        {(info || error) && <div className={error ? 'inline-alert error-alert' : 'inline-alert info-alert'}>{error ? <CircleHelp size={16}/> : <CheckCircle2 size={16}/>}<span>{error || info}</span></div>}
        <div className="section-divider"/>
        <div className="panel-title"><div className="step-badge">02</div><div><h2>Chuyển đổi thành câu hỏi</h2><p>Chọn cách nhận diện phù hợp với chất lượng PDF.</p></div></div>
        <div className="convert-options">
          <div className="convert-option"><div className="convert-icon purple"><Zap size={18}/></div><div><b>Tách tự động</b><p>Dựa vào mẫu câu “Câu 1”, A/B/C/D. Nhanh, không cần AI.</p></div><button className="button-outline small" onClick={reparseLocally} disabled={!text || isReading}>Tách câu</button></div>
          <div className="convert-option"><div className="convert-icon blue"><BrainCircuit size={18}/></div><div><b>AI phân tích</b><p>Hiểu cấu trúc đề linh hoạt hơn, nhận diện cả câu trả lời ngắn.</p></div><button className="button-primary small" onClick={() => void runAiParser()} disabled={!text || isAiParsing || isReading}>{isAiParsing ? <><LoaderCircle className="spin" size={14}/> Đang chạy</> : <><Sparkles size={14}/> Dùng AI</>}</button></div>
        </div>
        <div className="privacy-note"><LockKeyhole size={15}/><span>PDF được đọc trong trình duyệt. Chỉ khi bạn bấm “Dùng AI”, phần văn bản trích xuất mới được gửi tới AI để phân tích.</span></div>
      </div>

      <div className="panel upload-help-panel"><div className="help-icon"><Lightbulb size={20}/></div><h3>Mẹo để nhận diện chính xác</h3><ul><li>Ưu tiên PDF có thể bôi đen và sao chép văn bản.</li><li>Kiểm tra lại các công thức, ký hiệu và câu có hình.</li><li>Đề có đáp án nên để đáp án ở cuối PDF để AI đối chiếu.</li><li>Đề scan dạng ảnh hiện chưa OCR tự động trong bản đầu tiên.</li></ul><div className="help-divider"/><div className="help-bottom"><ShieldCheck size={16}/><span>Luôn kiểm tra câu hỏi và đáp án trước khi dùng để ôn tập.</span></div></div>
    </div>

    {questions.length > 0 && <section className="panel question-review-panel"><div className="section-heading"><div><h2>Xem trước câu hỏi</h2><p>Kiểm tra và chỉnh sửa nội dung trước khi lưu bộ đề.</p></div><span className="question-count-pill">{questions.length} câu</span></div>
      <div className="review-question-list">{questions.map((question, index) => <div className="review-question" key={question.id}><div className="review-question-head"><span className="question-number">Câu {question.number || index + 1}</span><span className="question-kind">{question.type === 'multiple' ? 'Nhiều đáp án' : question.type === 'short' ? 'Trả lời ngắn' : question.type === 'truefalse' ? 'Đúng / Sai' : question.type === 'dragdrop' ? 'Kéo thả / Menu' : question.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}</span>{question.section && <span className="question-kind">{question.section}</span>}<button className="icon-btn danger-hover" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} title="Xóa câu"><Trash2 size={15}/></button></div><textarea className="question-edit-input" value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} rows={2}/>{question.statements?.length ? <div className="statement-edit-list">{question.statements.map((statement, si) => <label key={`${question.id}-s-${statement.label}`}><b>{statement.label.toUpperCase()}</b><input value={statement.text} onChange={(event) => updateQuestion(index, { statements: question.statements?.map((candidate, ci) => ci === si ? { ...candidate, text: event.target.value } : candidate) })}/></label>)}</div> : null}{question.options.length > 0 && <div className="option-edit-grid">{question.options.map((option, oi) => <label key={`${question.id}-${option.label}`}><b>{option.label}</b><input value={option.text} onChange={(event) => updateQuestion(index, { options: question.options.map((candidate, ci) => ci === oi ? { ...candidate, text: event.target.value } : candidate) })}/></label>)}</div>}<div className="answer-edit-row"><label>Đáp án (để trống nếu chưa biết)<input value={question.answer ?? ''} onChange={(event) => updateQuestion(index, { answer: event.target.value.trim() ? event.target.value.toUpperCase() : null })} placeholder="Ví dụ: B hoặc A,C"/></label><label>Dạng câu<select value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as Question['type'] })}><option value="single">Một đáp án</option><option value="multiple">Nhiều đáp án</option><option value="short">Trả lời ngắn</option><option value="truefalse">Đúng / Sai</option><option value="dragdrop">Kéo thả / Menu</option><option value="essay">Tự luận</option></select></label></div></div>)}</div>
      <div className="save-exam-row"><div><b>Đã sẵn sàng lưu?</b><p>{questions.length} câu hỏi sẽ được lưu trong thư viện của trình duyệt này.</p></div><button className="button-primary" onClick={saveExam}><Save size={16}/> Lưu bộ đề</button></div>
    </section>}
  </div>;
}

function LibraryPage({ exams, onStart, onDelete, onNavigate }: { exams: Exam[]; onStart: (exam: Exam, duration?: number) => void; onDelete: (id: string) => void; onNavigate: (page: Page) => void }) {
  const [filter, setFilter] = useState<'Tất cả' | ExamType>('Tất cả');
  const filtered = exams.filter((exam) => filter === 'Tất cả' || exam.examType === filter);
  return <div className="page-content"><div className="page-title-row"><div><div className="eyebrow">TÀI LIỆU CỦA BẠN</div><h1>Thư viện <span>đề thi</span></h1><p>Tất cả bộ đề bạn đã chuyển đổi và lưu lại.</p></div><button className="button-primary" onClick={() => onNavigate('upload')}><Plus size={16}/> Tải đề mới</button></div>
    <div className="library-toolbar"><div className="filter-pills">{(['Tất cả', 'TSA', 'HSA', 'THPT', 'Khác'] as Array<'Tất cả' | ExamType>).map((item) => <button key={item} className={filter === item ? 'filter-pill selected' : 'filter-pill'} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="subtle-label">{filtered.length} bộ đề</span></div>
    {filtered.length ? <div className="library-grid">{filtered.map((exam) => <ExamCard key={exam.id} exam={exam} onStart={() => onStart(exam)} onDelete={() => onDelete(exam.id)}/>)}</div> : <EmptyState title="Không có đề phù hợp" text="Hãy chọn bộ lọc khác hoặc tải lên một đề PDF mới." action="Tải đề PDF" onClick={() => onNavigate('upload')}/>}
  </div>;
}

function SettingsPage({ code, setCode }: { code: string; setCode: (value: string) => void }) {
  const [apiUrl] = useState(getAiApiUrl());
  const [health, setHealth] = useState<{
    ok: boolean; aiConfigured?: boolean; message?: string;
    providers?: { gemini?: { configured: boolean; model: string; role: string }; cloudflare?: { configured: boolean; model: string; role: string } };
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState<'gemini' | 'cloudflare' | null>(null);
  const [message, setMessage] = useState('');
  const [providerMessages, setProviderMessages] = useState<{ gemini?: string; cloudflare?: string }>({});

  async function refreshHealth() {
    const baseUrl = apiUrl.trim() || window.location.origin;
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Máy chủ Render trả về HTTP ${response.status}.`);
    const result = await response.json();
    setHealth(result);
    return result;
  }

  useEffect(() => { void refreshHealth().catch(() => undefined); }, []);

  async function checkProvider(provider: 'gemini' | 'cloudflare') {
    setCheckingProvider(provider); setProviderMessages((previous) => ({ ...previous, [provider]: 'Đang gửi yêu cầu thử…' }));
    saveAccessCode(code);
    try {
      const config = health ?? await refreshHealth();
      const configured = provider === 'gemini' ? config.providers?.gemini?.configured : config.providers?.cloudflare?.configured;
      if (!configured) throw new Error(provider === 'gemini' ? 'Chưa có GEMINI_API_KEY trong Render Environment.' : 'Chưa có CLOUDFLARE_ACCOUNT_ID và CLOUDFLARE_API_TOKEN trong Render Environment.');
      const probe = await testAiConnection(code, provider);
      setProviderMessages((previous) => ({ ...previous, [provider]: `Kết nối thành công · ${probe.model}` }));
    } catch (error) {
      setProviderMessages((previous) => ({ ...previous, [provider]: error instanceof Error ? error.message : 'Không kiểm tra được nhà cung cấp AI.' }));
    } finally { setCheckingProvider(null); }
  }

  async function checkApi() {
    setChecking(true); setMessage(''); saveAccessCode(code);
    try {
      const result = await refreshHealth();
      if (!result.aiConfigured) { setMessage(result.message || 'Chưa cấu hình Gemini hoặc Cloudflare Workers AI trong Render Environment.'); return; }
      const probe = await testAiConnection(code, 'auto');
      setMessage(`Luồng AI chính/dự phòng đang hoạt động qua ${probe.provider} (${probe.model}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể kiểm tra kết nối AI.');
    } finally { setChecking(false); }
  }

  function saveCode() { saveAccessCode(code); setMessage('Đã lưu mã truy cập AI trên trình duyệt này.'); }
  const geminiReady = Boolean(health?.providers?.gemini?.configured);
  const cloudflareReady = Boolean(health?.providers?.cloudflare?.configured);

  return <div className="page-content narrow-page"><div className="page-title-row"><div><div className="eyebrow">CẤU HÌNH HỆ THỐNG</div><h1>Cài đặt <span>& AI</span></h1><p>Gemini ưu tiên; Cloudflare Workers AI dự phòng khi Gemini bận hoặc chạm hạn mức.</p></div><div className="page-title-icon"><Settings size={26}/></div></div>
    <div className="panel settings-panel"><div className="settings-section-head"><div className="settings-icon"><BrainCircuit size={20}/></div><div><h2>Hai nhà cung cấp AI</h2><p>Kiểm tra từng nhà cung cấp riêng, sau đó kiểm tra luồng tự động dự phòng.</p></div><span className="status-pill beta">Free tier*</span></div>
      <div className="provider-status-grid">
        <div className="provider-status-card"><div><b>Google Gemini</b><span className={geminiReady ? 'provider-dot ready' : 'provider-dot'} /></div><strong>{health?.providers?.gemini?.model || 'gemini-3.8-flash'}</strong><small>{geminiReady ? 'Đã khai báo API key' : 'Chưa cấu hình GEMINI_API_KEY'}</small><button className="button-outline small" disabled={checking || checkingProvider !== null || !geminiReady} onClick={() => void checkProvider('gemini')}>{checkingProvider === 'gemini' ? <LoaderCircle className="spin" size={13}/> : <Zap size={13}/>} Kiểm tra Gemini</button>{providerMessages.gemini && <small className={providerMessages.gemini.includes('thành công') ? 'provider-test-ok' : 'provider-test-error'}>{providerMessages.gemini}</small>}</div>
        <div className="provider-status-card"><div><b>Cloudflare Workers AI</b><span className={cloudflareReady ? 'provider-dot ready' : 'provider-dot'} /></div><strong>{health?.providers?.cloudflare?.model || '@cf/google/gemma-4-26b-a4b-it'}</strong><small>{cloudflareReady ? 'Đã khai báo Account ID và Token' : 'Chưa cấu hình CLOUDFLARE_ACCOUNT_ID / TOKEN'}</small><button className="button-outline small" disabled={checking || checkingProvider !== null || !cloudflareReady} onClick={() => void checkProvider('cloudflare')}>{checkingProvider === 'cloudflare' ? <LoaderCircle className="spin" size={13}/> : <Zap size={13}/>} Kiểm tra Cloudflare</button>{providerMessages.cloudflare && <small className={providerMessages.cloudflare.includes('thành công') ? 'provider-test-ok' : 'provider-test-error'}>{providerMessages.cloudflare}</small>}</div>
      </div>
      <div className="settings-field"><label>Địa chỉ API AI</label><input value={apiUrl} placeholder="Tự động dùng cùng địa chỉ website" disabled/><small>Render đang phục vụ cả giao diện và API nên để trống là đúng.</small></div>
      <div className="settings-field"><label>Mã truy cập AI</label><div className="password-input"><input type="password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Nhập APP_ACCESS_CODE đã đặt trên Render"/><button className="button-outline small" onClick={saveCode}><Save size={14}/> Lưu mã</button></div><small>Mã này phải trùng APP_ACCESS_CODE trong Render Environment. Không chia sẻ mã này.</small></div>
      <div className="settings-actions"><button className="button-primary" onClick={() => void checkApi()} disabled={checking || checkingProvider !== null}>{checking ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Kiểm tra luồng tự động</button>{health && <span className={health.aiConfigured ? 'connection-ok' : 'connection-warn'}>{health.aiConfigured ? <CheckCircle2 size={15}/> : <CircleHelp size={15}/>} {health.aiConfigured ? 'Có ít nhất một AI đã cấu hình' : 'Chưa có AI'}</span>}</div>
      {message && <div className={`inline-alert ${message.includes('thành công') ? 'info-alert' : 'error-alert'}`}><CircleHelp size={15}/><span>{message}</span></div>}
      <small className="free-tier-footnote">* Gói miễn phí có hạn mức/ngày và giới hạn tốc độ; khi cả hai nhà cung cấp chạm hạn mức, AI sẽ tạm dừng đến khi hạn mức được làm mới.</small>
    </div>
    <div className="panel settings-panel cf-setup-help"><div className="settings-section-head"><div className="settings-icon blue-settings"><Zap size={20}/></div><div><h2>Thiết lập Cloudflare dự phòng</h2><p>Cần thêm đủ Account ID và API Token ở Render → Environment.</p></div></div><ol><li>Mở Cloudflare Dashboard → Workers AI → Use REST API.</li><li>Chọn <b>Create a Workers AI API Token</b>, tạo và sao chép token; sao chép Account ID trên cùng trang.</li><li>Thêm vào Render: <code>CLOUDFLARE_ACCOUNT_ID</code> và <code>CLOUDFLARE_API_TOKEN</code>. Không đưa các giá trị này lên GitHub.</li></ol><p className="settings-help-note">Nếu tự tạo Custom Token, cấp cả quyền Workers AI – Read và Workers AI – Edit. Model mặc định: <code>@cf/google/gemma-4-26b-a4b-it</code>.</p><a href="https://developers.cloudflare.com/workers-ai/get-started/rest-api/" target="_blank" rel="noreferrer">Xem hướng dẫn chính thức của Cloudflare <ArrowRight size={13}/></a></div>
    <div className="panel settings-panel"><div className="settings-section-head"><div className="settings-icon green-settings"><ShieldCheck size={20}/></div><div><h2>Quyền riêng tư & lưu trữ</h2><p>Hiểu rõ dữ liệu được gửi đi đâu.</p></div></div><div className="privacy-list"><div><CheckCircle2 size={16}/><span>PDF, đề, câu trả lời và lịch sử làm bài lưu trong trình duyệt trên thiết bị này.</span></div><div><CheckCircle2 size={16}/><span>Khi dùng AI, máy chủ gọi Gemini trước; nếu lỗi hoặc quá tải, có thể chuyển sang Cloudflare Workers AI.</span></div><div><CheckCircle2 size={16}/><span>Gemini API key, Cloudflare Account ID và API Token chỉ đặt trong Environment/Secrets của Render, không đưa lên GitHub hoặc giao diện.</span></div><div><CircleHelp size={16}/><span>Gemini Free Tier có thể dùng dữ liệu gửi lên để cải thiện sản phẩm. Tránh tải tài liệu chứa thông tin cá nhân.</span></div></div></div>
    <div className="panel settings-panel"><div className="settings-section-head"><div className="settings-icon amber-settings"><BookOpen size={20}/></div><div><h2>Giới hạn và cách chấm điểm</h2><p>Phòng thi mô phỏng cấu trúc, không giả mạo kết quả chính thức.</p></div></div><ul className="feature-limits"><li>PDF có lớp văn bản được trích xuất; PDF scan ảnh chưa có OCR tự động.</li><li>Biểu đồ, hình học hoặc hình minh họa có thể không nằm trong lớp văn bản PDF; hãy đối chiếu file gốc.</li><li>AI giải theo nhóm nhỏ, lưu từng nhóm thành công để tiếp tục khi bị giới hạn API.</li><li>Điểm phần trăm chỉ tính trên câu đã có đáp án gốc. Nếu không có đáp án chuẩn thì không thể chấm tự động đáng tin cậy.</li><li>IRT chính thức cần tham số câu hỏi được hiệu chuẩn bằng dữ liệu thí sinh; phiên bản này không tự tạo điểm IRT giả. Báo cáo dùng tỷ lệ đúng và phân tích theo phần.</li></ul></div>
  </div>;
}

function normalizeAnswer(value: string) {
  return value.toUpperCase().replace(/\s+/g, '').split(',').filter(Boolean).sort().join(',');
}

function trueFalseMap(value: string) {
  return Object.fromEntries(value.split(',').filter(Boolean).map((part) => {
    const [key, val] = part.split('=');
    return [key?.trim().toLowerCase(), val?.trim().toUpperCase()];
  }));
}

function thptMaxPoints(question: Question, subject: string) {
  if (!question.answer?.trim() || question.type === 'essay') return 0;
  if (question.type === 'truefalse') {
    const key = trueFalseMap(question.answer);
    return question.statements?.length === 4 && ['a', 'b', 'c', 'd'].every((label) => key[label] === 'Đ' || key[label] === 'S') ? 1 : 0;
  }
  if (question.type === 'short') return subject === 'Toán' ? 0.5 : 0.25;
  return 0.25;
}

function thptQuestionPoints(question: Question, studentAnswer: string, subject: string) {
  const max = thptMaxPoints(question, subject);
  if (!max || !studentAnswer.trim()) return { earned: 0, max };
  if (question.type === 'truefalse') {
    const key = trueFalseMap(question.answer || '');
    const response = trueFalseMap(studentAnswer);
    const correctParts = ['a', 'b', 'c', 'd'].filter((label) => response[label] === key[label]).length;
    const earned = correctParts === 4 ? 1 : correctParts === 3 ? 0.5 : correctParts === 2 ? 0.25 : correctParts === 1 ? 0.1 : 0;
    return { earned, max };
  }
  return { earned: normalizeAnswer(studentAnswer) === normalizeAnswer(question.answer || '') ? max : 0, max };
}

function QuizView({ exam, duration, onBack, onFinish, onUpdateExam }: {
  exam: Exam; duration: number; onBack: () => void; onFinish: (attempt: Attempt) => void; onUpdateExam: (exam: Exam) => void;
}) {
  const sessionKey = `onthi-exam-session-${exam.id}`;
  const sectionTemplates = getExamSections(exam);
  const sectionTimed = (exam.examType === 'TSA' && exam.questions.length === 100) || (exam.examType === 'HSA' && exam.questions.length === 150);
  const savedSession = (() => {
    try { return JSON.parse(localStorage.getItem(sessionKey) || 'null') as { answers?: Record<string, string>; current?: number; timeLeft?: number; sectionIndex?: number; flagged?: string[] } | null; }
    catch { return null; }
  })();
  const initialSectionIndex = Math.max(0, Math.min(sectionTemplates.length - 1, savedSession?.sectionIndex ?? 0));
  const [sectionIndex, setSectionIndex] = useState(initialSectionIndex);
  const [current, setCurrent] = useState(Math.max(0, Math.min(exam.questions.length - 1, savedSession?.current ?? 0)));
  const [answers, setAnswers] = useState<Record<string, string>>(savedSession?.answers ?? {});
  const [flagged, setFlagged] = useState<string[]>(savedSession?.flagged ?? []);
  const [timeLeft, setTimeLeft] = useState(savedSession?.timeLeft ?? (sectionTimed ? sectionTemplates[initialSectionIndex].minutes * 60 : duration * 60));
  const [submitted, setSubmitted] = useState(false);
  const [solutions, setSolutions] = useState<Record<string, AISolution>>(() => Object.fromEntries(exam.questions.filter((item) => item.aiAnswer || item.aiExplanation).map((item) => [item.id, { answer: item.aiAnswer ?? '', explanation: item.aiExplanation ?? '', confidence: item.aiConfidence, provider: item.aiProvider }])));
  const [loadingAi, setLoadingAi] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });
  const [bulkMessage, setBulkMessage] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [showAiAsk, setShowAiAsk] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('Tất cả');
  const question = exam.questions[current];
  const answeredCount = Object.values(answers).filter((answer) => answer.trim()).length;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const questionSections = exam.questions.map((item, index) => getQuestionSectionName(item, exam, index, exam.questions.length));
  const canonicalSection = (value: string) => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const questionSectionIndexes = questionSections.map((name, index) => {
    const key = canonicalSection(name);
    if (exam.examType === 'TSA') {
      if (key.includes('toan')) return 0;
      if (key.includes('doc')) return 1;
      if (key.includes('khoa') || key.includes('giaiquyet')) return 2;
      return index < 40 ? 0 : index < 60 ? 1 : 2;
    }
    if (exam.examType === 'HSA') {
      if (key.includes('toan')) return 0;
      if (key.includes('van') || key.includes('ngonngu')) return 1;
      if (key.includes('khoa') || key.includes('tienganh')) return 2;
      return index < 50 ? 0 : index < 100 ? 1 : 2;
    }
    return 0;
  });
  const sectionIndexes = sectionTemplates.map((_, sectionNo) => questionSectionIndexes.map((value, index) => value === sectionNo ? index : -1).filter((index) => index >= 0));
  const sectionStats = sectionTemplates.map((section, index) => ({ name: section.name, indexes: sectionIndexes[index] ?? [] }));
  const activeQuestionIndexes = sectionTimed ? (sectionIndexes[sectionIndex] ?? []) : exam.questions.map((_, index) => index);
  const currentPosition = activeQuestionIndexes.indexOf(current);
  const currentSection = questionSections[current] || 'Phần luyện tập';

  useEffect(() => {
    if (submitted || bulkLoading) return;
    const timer = window.setInterval(() => setTimeLeft((value) => {
      if (value <= 1) { window.clearInterval(timer); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [submitted, bulkLoading]);

  useEffect(() => {
    if (!submitted) localStorage.setItem(sessionKey, JSON.stringify({ answers, current, timeLeft, sectionIndex, flagged }));
  }, [answers, current, timeLeft, sectionIndex, flagged, submitted, sessionKey]);

  useEffect(() => {
    if (!submitted && timeLeft === 0) {
      if (sectionTimed) advanceSection();
      else finishQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, submitted, sectionTimed, sectionIndex]);

  function goToQuestion(index: number) {
    const allowed = sectionTimed ? activeQuestionIndexes : exam.questions.map((_, itemIndex) => itemIndex);
    if (!allowed.includes(index)) return;
    setCurrent(index);
    setActiveSection(questionSections[index] || 'Tất cả');
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  function setTrueFalseAnswer(questionId: string, label: string, value: 'Đ' | 'S') {
    const existing = answers[questionId] || '';
    const currentMap = Object.fromEntries(existing.split(',').filter(Boolean).map((part) => {
      const [key, val] = part.split('='); return [key?.toLowerCase(), val?.toUpperCase()];
    }));
    currentMap[label.toLowerCase()] = value;
    const next = Object.entries(currentMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${key}=${val}`).join(',');
    setAnswer(questionId, next);
  }

  function finishQuiz() {
    if (submitted) return;
    setSubmitted(true);
    localStorage.removeItem(sessionKey);
    const graded = exam.questions.filter((item) => item.type !== 'essay' && item.answer !== null && item.answer.trim());
    const correct = graded.filter((item) => normalizeAnswer(answers[item.id] ?? '') === normalizeAnswer(item.answer ?? '')).length;
    const unanswered = exam.questions.filter((item) => !(answers[item.id] ?? '').trim()).length;
    if (exam.examType === 'THPT') {
      const parts = exam.questions.map((item) => thptQuestionPoints(item, answers[item.id] ?? '', exam.subject || ''));
      const maxScore = Number(parts.reduce((sum, part) => sum + part.max, 0).toFixed(2));
      const score = Number(parts.reduce((sum, part) => sum + part.earned, 0).toFixed(2));
      const accuracy = maxScore ? Math.round((score / maxScore) * 100) : 0;
      onFinish({ id: newId(), examId: exam.id, examTitle: exam.title, completedAt: new Date().toISOString(), total: graded.length, graded: graded.length, correct, unanswered, accuracy, score, maxScore });
      return;
    }
    onFinish({ id: newId(), examId: exam.id, examTitle: exam.title, completedAt: new Date().toISOString(), total: graded.length, graded: graded.length, correct, unanswered, accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0 });
  }

  function advanceSection() {
    if (!sectionTimed) { finishQuiz(); return; }
    if (sectionIndex >= sectionTemplates.length - 1) { finishQuiz(); return; }
    const nextSection = sectionIndex + 1;
    const firstQuestion = sectionIndexes[nextSection]?.[0];
    if (firstQuestion === undefined) { finishQuiz(); return; }
    setSectionIndex(nextSection);
    setActiveSection(sectionTemplates[nextSection].name);
    setCurrent(firstQuestion);
    setTimeLeft(sectionTemplates[nextSection].minutes * 60);
  }

  function persistSolution(questionId: string, solution: AISolution) {
    const updatedExam: Exam = {
      ...exam,
      questions: exam.questions.map((item) => item.id === questionId ? {
        ...item,
        aiAnswer: solution.answer,
        aiExplanation: solution.explanation,
        aiConfidence: solution.confidence === 'high' || solution.confidence === 'low' ? solution.confidence : 'medium',
        aiProvider: solution.provider,
      } : item),
    };
    onUpdateExam(updatedExam);
  }

  async function askAi(target: Question) {
    setLoadingAi(target.id);
    try {
      const solution = await explainWithAi(target, exam.examType, showAiAsk === target.id ? aiQuestion : '', answers[target.id] ?? '');
      setSolutions((previous) => ({ ...previous, [target.id]: solution }));
      persistSolution(target.id, solution);
      setShowAiAsk(null); setAiQuestion('');
    } catch (error) {
      setSolutions((previous) => ({ ...previous, [target.id]: { answer: '', explanation: error instanceof Error ? error.message : 'Không gọi được AI.' } }));
    } finally { setLoadingAi(null); }
  }

  async function solveWholeExam() {
    if (bulkLoading || loadingAi) return;
    const pending = exam.questions.filter((item) => !item.aiAnswer && !item.aiExplanation && !solutions[item.id]?.answer && !solutions[item.id]?.explanation);
    if (!pending.length) { setBulkMessage('Tất cả câu trong đề đã có lời giải AI được lưu.'); return; }
    setBulkLoading(true);
    setBulkProgress({ completed: 0, total: pending.length });
    setBulkMessage('AI đang giải theo nhóm 3 câu. Kết quả được lưu sau từng nhóm.');
    const collected: Record<string, AISolution> = {};
    try {
      await solveAllWithAi(pending, exam.examType, (completed, total, batchSolutions) => {
        Object.assign(collected, batchSolutions);
        setSolutions((previous) => ({ ...previous, ...batchSolutions }));
        setBulkProgress({ completed: Object.keys(collected).length, total });
        const updatedExam: Exam = {
          ...exam,
          questions: exam.questions.map((item) => {
            const solution = collected[item.id];
            if (!solution) return item;
            return { ...item, aiAnswer: solution.answer, aiExplanation: solution.explanation, aiConfidence: solution.confidence === 'high' || solution.confidence === 'low' ? solution.confidence : 'medium', aiProvider: solution.provider };
          }),
        };
        onUpdateExam(updatedExam);
      });
      setBulkMessage(`Đã giải xong ${Object.keys(collected).length}/${pending.length} câu. Lời giải đã lưu trong thư viện đề.`);
    } catch (error) {
      const saved = Object.keys(collected).length;
      setBulkMessage(`${error instanceof Error ? error.message : 'Không thể giải toàn bộ đề.'}${saved ? ` Đã lưu ${saved} câu thành công; bấm lại để giải tiếp các câu còn lại.` : ''}`);
    } finally { setBulkLoading(false); }
  }

  if (!exam.questions.length) return <div className="quiz-empty"><b>Bộ đề chưa có câu hỏi.</b><button className="button-primary" onClick={onBack}>Quay lại</button></div>;
  const progress = ((current + 1) / exam.questions.length) * 100;
  const resultCorrect = exam.questions.filter((item) => item.answer && normalizeAnswer(answers[item.id] ?? '') === normalizeAnswer(item.answer)).length;
  const gradedCount = exam.questions.filter((item) => item.type !== 'essay' && item.answer?.trim()).length;
  const pendingCount = exam.questions.length - gradedCount;
  const aiSolvedCount = exam.questions.filter((item) => item.aiAnswer || item.aiExplanation || solutions[item.id]?.answer || solutions[item.id]?.explanation).length;
  const bulkSolveControl = <div className="bulk-solve-control"><button className="button-primary small" onClick={() => void solveWholeExam()} disabled={bulkLoading || Boolean(loadingAi) || aiSolvedCount === exam.questions.length}>{bulkLoading ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>} {bulkLoading ? `Đang giải ${bulkProgress.completed}/${bulkProgress.total} câu` : aiSolvedCount === exam.questions.length ? 'Đã có lời giải toàn đề' : `AI giải toàn bộ đề (${exam.questions.length - aiSolvedCount} câu)`}</button>{bulkMessage && <small className="bulk-solve-status">{bulkMessage}</small>}</div>;
  const sectionResult = sectionStats.map((section) => {
    const items = section.indexes.map((index) => exam.questions[index]);
    const graded = items.filter((item) => item.type !== 'essay' && item.answer?.trim());
    const correct = graded.filter((item) => normalizeAnswer(answers[item.id] ?? '') === normalizeAnswer(item.answer ?? '')).length;
    return { ...section, total: items.length, graded: graded.length, correct, accuracy: graded.length ? Math.round((correct / graded.length) * 100) : null };
  });
  const displayPercent = gradedCount ? Math.round((resultCorrect / gradedCount) * 100) : null;
  const thptParts = exam.questions.map((item) => thptQuestionPoints(item, answers[item.id] ?? '', exam.subject || ''));
  const thptMaxScore = Number(thptParts.reduce((sum, part) => sum + part.max, 0).toFixed(2));
  const thptEarnedScore = Number(thptParts.reduce((sum, part) => sum + part.earned, 0).toFixed(2));
  const fullOfficialFormat = (exam.examType === 'TSA' && exam.questions.length === 100) || (exam.examType === 'HSA' && exam.questions.length === 150);
  const officialScoreHint = fullOfficialFormat && gradedCount === exam.questions.length ? `Điểm luyện tập thô: ${resultCorrect}/${exam.examType === 'TSA' ? 100 : 150} câu đúng · không phải điểm IRT/điểm chuẩn hóa chính thức` : '';
  const practiceIndex = exam.examType === 'THPT' ? (thptMaxScore ? Math.round((thptEarnedScore / thptMaxScore) * 100) : null) : displayPercent;
  const practiceBand = practiceIndex === null ? 'Chưa đủ dữ liệu' : practiceIndex >= 85 ? 'Rất tốt' : practiceIndex >= 70 ? 'Khá vững' : practiceIndex >= 50 ? 'Đang tiến bộ' : 'Cần củng cố thêm';

  return <div className="quiz-shell">
    <header className="quiz-topbar"><button className="quiz-back" onClick={() => { if (!submitted && answeredCount && !window.confirm('Bạn muốn thoát? Tiến trình đang làm sẽ được lưu trên trình duyệt.')) return; onBack(); }}><ArrowLeft size={17}/> Thoát bài thi</button><div className="quiz-brand"><div className="brand-mark mini-mark"><GraduationCap size={18}/></div><b>Ôn Thi <span>AI</span></b></div><div className="quiz-top-meta"><span className={`type-chip type-${exam.examType.toLowerCase()}`}>{exam.examType}</span><span>{exam.title}</span></div><div className={`quiz-timer ${timeLeft < 300 ? 'timer-warning' : ''}`}><Timer size={17}/><b>{mm}:{ss}</b></div></header>
    <div className="quiz-progress"><span style={{ width: `${progress}%` }}/></div>
    {!submitted ? <div className="quiz-body"><div className="quiz-main-column">
      <div className="exam-room-banner"><div><span className="eyebrow">PHÒNG THI MÔ PHỎNG · {exam.examType}</span><h1>{exam.title}</h1><p>{exam.examType === 'TSA' ? '3 phần thi · 150 phút · thang tham chiếu 100 điểm' : exam.examType === 'HSA' ? '3 phần thi · 195 phút · thang tham chiếu 150 điểm' : `Bài thi môn ${exam.subject || 'THPT'} · thời gian theo môn`}</p></div><div className="room-clock"><small>{sectionTimed ? `PHẦN ${sectionIndex + 1}/${sectionTemplates.length} · THỜI GIAN CÒN LẠI` : 'THỜI GIAN CÒN LẠI'}</small><b>{mm}:{ss}</b></div></div>
      <div className="exam-section-strip">{sectionTemplates.map((section) => {
        const matching = sectionStats.find((item) => canonicalSection(item.name) === canonicalSection(section.name)) || (section.id === 'hsa-choice' ? sectionStats.find((item) => canonicalSection(item.name).includes('khoa') || canonicalSection(item.name).includes('tienganh')) : undefined);
        const selected = sectionTimed ? sectionIndex === sectionTemplates.indexOf(section) : activeSection === section.name || activeSection === matching?.name;
        return <button key={section.id} className={`exam-section-card ${selected ? 'selected' : ''}`} disabled={sectionTimed && sectionIndex !== sectionTemplates.indexOf(section)} onClick={() => {
          if (sectionTimed) return;
          const first = matching?.indexes[0];
          setActiveSection(matching?.name || section.name);
          if (first !== undefined) setCurrent(first);
        }}><b>{section.name}</b><span>{section.minutes} phút · {section.points} điểm</span><small>{matching ? `${matching.indexes.length} câu đã nhận diện` : 'Chưa tách được câu thuộc phần này'}</small></button>;
      })}</div>
      {((exam.examType === 'TSA' && exam.questions.length !== 100) || (exam.examType === 'HSA' && exam.questions.length !== 150)) && exam.examType !== 'THPT' && <div className="practice-note">Đây là đề luyện tập hoặc PDF chưa đủ toàn bộ câu. Cấu trúc phần thi ở trên là mốc tham chiếu; hệ thống không tự thêm câu còn thiếu.</div>}
      <div className="quiz-context"><div><span className="eyebrow">PHẦN: {currentSection.toUpperCase()}</span><p>{sectionTimed ? `Phần ${sectionIndex + 1}/${sectionTemplates.length} · chỉ làm các câu trong phần đang mở.` : 'Đọc kỹ câu hỏi; bạn có thể đánh dấu và quay lại các câu trước.'}</p><small className="exam-integrity-note">AI giải đề và hỏi gia sư sẽ mở sau khi bạn nộp bài, giống một ca thi thử nghiêm túc.</small></div><div className="quiz-progress-note"><b>{current + 1}<span>/{exam.questions.length}</span></b><small>Câu hiện tại</small></div></div>
      <div className="panel quiz-question-card"><div className="question-topline"><span className="question-index">CÂU {question.number || current + 1}</span><span className="question-type-tag">{question.type === 'multiple' ? 'Chọn nhiều đáp án' : question.type === 'short' ? 'Trả lời ngắn' : question.type === 'truefalse' ? 'Đúng / Sai' : question.type === 'dragdrop' ? 'Kéo thả / Menu' : question.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}</span>{question.subject && <span className="question-subject">{question.subject}</span>}<button type="button" className={`flag-question-button ${flagged.includes(question.id) ? 'flagged' : ''}`} onClick={() => setFlagged((previous) => previous.includes(question.id) ? previous.filter((id) => id !== question.id) : [...previous, question.id])}><Flag size={14}/>{flagged.includes(question.id) ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}</button></div><div className="question-prompt">{question.prompt}</div>
        {question.type === 'essay' ? <div className="short-answer-wrap essay-answer-wrap"><label>Nhập bài làm của bạn</label><textarea value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder="Viết câu trả lời / bài làm của bạn…" rows={8}/><small>AI có thể nhận xét nội dung và gợi ý cải thiện; phản hồi này không thay thế điểm chấm chính thức.</small></div> : question.type === 'short' ? <div className="short-answer-wrap"><label>Nhập câu trả lời của bạn</label><input value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder="Nhập đáp án…"/></div> : question.type === 'truefalse' ? <div className="truefalse-list">{(question.statements ?? []).map((statement) => {
          const selected = Object.fromEntries((answers[question.id] || '').split(',').filter(Boolean).map((part) => { const [key, val] = part.split('='); return [key?.toLowerCase(), val?.toUpperCase()]; }));
          return <div className="truefalse-row" key={statement.label}><b>{statement.label.toUpperCase()}. {statement.text}</b><div><button className={selected[statement.label.toLowerCase()] === 'Đ' ? 'tf-choice selected' : 'tf-choice'} onClick={() => setTrueFalseAnswer(question.id, statement.label, 'Đ')}>Đúng</button><button className={selected[statement.label.toLowerCase()] === 'S' ? 'tf-choice selected' : 'tf-choice'} onClick={() => setTrueFalseAnswer(question.id, statement.label, 'S')}>Sai</button></div></div>;
        })}</div> : question.type === 'dragdrop' ? <div className="dragdrop-answer-wrap"><div className="dragdrop-target" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const label = event.dataTransfer.getData('text/plain'); if (question.options.some((option) => option.label === label)) setAnswer(question.id, label); }}><small>Ô trả lời · kéo một thẻ vào đây hoặc chọn bên dưới</small><b>{question.options.find((option) => option.label === answers[question.id])?.text || 'Chưa chọn đáp án'}</b></div><div className="dragdrop-options">{question.options.map((option) => <button key={option.label} type="button" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', option.label)} className={`dragdrop-chip ${answers[question.id] === option.label ? 'selected' : ''}`} onClick={() => setAnswer(question.id, option.label)}><span>{option.label}</span>{option.text}</button>)}</div><label className="dragdrop-mobile-select">Hoặc chọn đáp án<select value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)}><option value="">Chọn đáp án</option>{question.options.map((option) => <option key={option.label} value={option.label}>{option.label}. {option.text}</option>)}</select></label></div> : <div className="quiz-options">{question.options.map((option) => {
          const selectedValues = (answers[question.id] ?? '').split(',').filter(Boolean);
          const selected = selectedValues.includes(option.label);
          return <button key={option.label} className={`quiz-option ${selected ? 'selected' : ''}`} onClick={() => {
            if (question.type === 'multiple') { const next = selected ? selectedValues.filter((value) => value !== option.label) : [...selectedValues, option.label]; setAnswer(question.id, next.sort().join(',')); }
            else setAnswer(question.id, option.label);
          }}><span className="option-marker">{question.type === 'multiple' ? (selected ? <Check size={14}/> : '') : option.label}</span><span>{option.text}</span>{selected && <CheckCircle2 className="option-check" size={17}/>}</button>;
        })}</div>}
        {solutions[question.id] && <div className="ai-solution-inline"><div className="ai-solution-head"><Sparkles size={16}/><b>Gia sư AI {solutions[question.id].provider ? `· ${solutions[question.id].provider}` : ''}</b><button className="icon-btn" onClick={() => setSolutions((previous) => { const next = { ...previous }; delete next[question.id]; return next; })}><X size={14}/></button></div>{solutions[question.id].answer && <p><b>Đáp án AI gợi ý: {solutions[question.id].answer}</b></p>}<p>{solutions[question.id].explanation}</p><small>Mức độ tin cậy: {solutions[question.id].confidence === 'high' ? 'cao' : solutions[question.id].confidence === 'low' ? 'thấp' : 'trung bình'}. Đây là lời giải tham khảo, không phải đáp án chính thức.</small></div>}
        <div className="quiz-question-bottom"><span>{answers[question.id]?.trim() ? 'Đã chọn câu trả lời' : 'Chưa trả lời'}</span><span className="exam-integrity-note-inline">Gia sư AI mở sau khi nộp bài</span></div>
      </div>
      <div className="quiz-navigation"><button className="button-outline" onClick={() => goToQuestion(activeQuestionIndexes[Math.max(0, currentPosition - 1)] ?? current)} disabled={currentPosition <= 0}><ChevronLeft size={16}/> Câu trước</button><div className="quiz-nav-center"><span>{answeredCount}/{exam.questions.length} đã trả lời</span><button className="button-primary" onClick={() => { if (sectionTimed && currentPosition === activeQuestionIndexes.length - 1) { const label = sectionIndex === sectionTemplates.length - 1 ? 'Nộp bài thi' : 'Nộp phần và sang phần tiếp theo'; if (window.confirm(`${label}? Bạn sẽ không quay lại phần đã nộp.`)) advanceSection(); } else if (current === exam.questions.length - 1) finishQuiz(); else goToQuestion(activeQuestionIndexes[Math.min(activeQuestionIndexes.length - 1, currentPosition + 1)] ?? current + 1); }}>{sectionTimed && currentPosition === activeQuestionIndexes.length - 1 ? sectionIndex === sectionTemplates.length - 1 ? 'Nộp bài' : 'Nộp phần thi' : current === exam.questions.length - 1 ? 'Nộp bài' : 'Câu tiếp theo'} <ArrowRight size={15}/></button></div></div>
    </div><aside className="quiz-side-column"><div className="panel question-map-panel"><div className="section-heading"><div><h3>Bản đồ câu hỏi</h3><p>Chọn số câu để chuyển nhanh.</p></div></div><div className="question-map-grid">{activeQuestionIndexes.map((index) => { const item = exam.questions[index]; return <button key={item.id} title={questionSections[index]} className={`map-number ${current === index ? 'current' : ''} ${(answers[item.id] ?? '').trim() ? 'answered' : ''} ${flagged.includes(item.id) ? 'flagged' : ''}`} onClick={() => goToQuestion(index)}>{item.number || index + 1}</button>; })}</div><div className="map-legend"><span><i className="legend-current"/> Đang xem</span><span><i className="legend-answered"/> Đã trả lời</span><span><i/> Chưa làm</span></div></div><div className="panel quiz-guide-panel"><div className="guide-icon"><Lightbulb size={18}/></div><b>Thông tin phòng thi</b><p>{sectionTimed ? 'Mỗi phần có đồng hồ riêng. Khi hết giờ hoặc nộp phần, hệ thống chuyển sang phần kế tiếp và khóa phần đã hoàn thành.' : 'Câu trả lời và đồng hồ được lưu tạm trong trình duyệt này. Khi nộp bài, hệ thống chấm theo đáp án gốc đã nhập hoặc có trong PDF.'}</p><div className="guide-divider"/><div className="guide-stats"><span>Đã trả lời</span><b>{answeredCount}/{exam.questions.length}</b></div><div className="guide-stats"><span>Có đáp án gốc để chấm</span><b>{gradedCount}/{exam.questions.length}</b></div><div className="guide-stats"><span>Đã đánh dấu xem lại</span><b>{flagged.length}</b></div><div className="guide-stats"><span>Lời giải AI đã lưu</span><b>{aiSolvedCount}/{exam.questions.length}</b></div><button className="button-outline full-width" onClick={finishQuiz}>Nộp bài</button></div></aside></div> : <div className="quiz-result-wrap"><div className="result-hero"><div className="result-trophy"><GraduationCap size={32}/></div><div className="eyebrow">BẠN ĐÃ HOÀN THÀNH</div><h1>Kết quả phòng thi</h1><p>{exam.title}</p><div className="result-score"><b>{exam.examType === 'THPT' ? (thptMaxScore ? thptEarnedScore.toFixed(2) : '—') : (fullOfficialFormat && gradedCount === exam.questions.length ? String(resultCorrect) : (displayPercent ?? '—'))}<small>{exam.examType === 'THPT' && thptMaxScore ? `/${thptMaxScore.toFixed(2)}` : fullOfficialFormat && gradedCount === exam.questions.length ? `/${exam.questions.length}` : displayPercent === null ? '' : '%'}</small></b><span>{exam.examType === 'THPT' ? (thptMaxScore ? `Điểm phần có đáp án gốc theo dạng thức: ${thptEarnedScore.toFixed(2)}/${thptMaxScore.toFixed(2)}` : 'Chưa có đáp án gốc hoặc chưa đủ cấu trúc để tính điểm tự động.') : gradedCount ? `${resultCorrect}/${gradedCount} câu có đáp án gốc được chấm đúng${fullOfficialFormat && gradedCount === exam.questions.length ? ' · số câu đúng thô, không phải điểm IRT chuẩn hóa' : ''}` : 'Đề chưa có đáp án gốc nên chưa thể tự chấm điểm.'}</span>{exam.examType === 'THPT' && thptMaxScore > 0 && thptMaxScore < 10 && <strong className="practice-score-hint">Bài/đáp án chưa đủ toàn bộ thang 10 điểm; điểm đang hiển thị là phần có thể chấm.</strong>}{officialScoreHint && <strong className="practice-score-hint">{officialScoreHint}</strong>}</div></div><div className="result-stats-grid"><div><b>{exam.questions.length}</b><span>Tổng câu hỏi</span></div><div><b>{answeredCount}</b><span>Đã trả lời</span></div><div><b>{exam.questions.length - answeredCount}</b><span>Bỏ trống</span></div><div><b>{pendingCount}</b><span>Thiếu đáp án gốc</span></div></div><div className="panel practice-index-panel"><div><small>CHỈ SỐ LUYỆN TẬP THAM KHẢO</small><b>{practiceIndex === null ? '—' : `${practiceIndex}/100`}</b><strong>{practiceBand}</strong></div><div className="practice-index-meter"><i style={{ width: `${practiceIndex ?? 0}%` }}/></div><p>Chỉ số được tính từ tỷ lệ đúng trên câu có đáp án gốc (THPT dùng điểm theo rubric đã cài). Đây không phải điểm IRT hoặc điểm chuẩn hóa của đơn vị tổ chức kỳ thi.</p></div><div className="panel result-breakdown"><div className="section-heading"><div><h2>Phân tích theo phần thi</h2><p>Tỷ lệ đúng trên số câu có đáp án gốc.</p></div></div>{sectionResult.map((section) => <div className="breakdown-row" key={section.name}><div><b>{section.name}</b><span>{section.correct}/{section.graded} câu đúng · {section.total} câu</span></div><strong>{section.accuracy === null ? '—' : `${section.accuracy}%`}</strong><div className="breakdown-bar"><i style={{ width: `${section.accuracy ?? 0}%` }}/></div></div>)}<div className="irt-note"><b>Về điểm IRT</b><p>Chưa thể báo điểm IRT chuẩn hóa trong bản này vì cần bộ tham số câu hỏi được hiệu chuẩn trên dữ liệu làm bài của nhiều thí sinh. Báo cáo hiện dùng tỷ lệ đúng, không giả lập điểm thi chính thức.</p></div></div><div className="panel result-review-panel"><div className="section-heading result-review-heading"><div><h2>Chữa và xem lại từng câu</h2><p>Đối chiếu đáp án gốc, câu trả lời và lời giải AI.</p></div>{bulkSolveControl}</div>{exam.questions.map((item, index) => {const userAnswer = answers[item.id] ?? ''; const correct = item.answer ? normalizeAnswer(item.answer) === normalizeAnswer(userAnswer) : null; const solution = solutions[item.id]; return <div className="result-question-row" key={item.id}><div className="result-question-heading"><span className="question-number">Câu {item.number || index + 1} · {questionSections[index]}</span>{correct === null ? <span className="status-pill pending">Chưa có đáp án gốc</span> : correct ? <span className="status-pill done"><Check size={12}/> Đúng</span> : <span className="status-pill wrong">Sai / chưa trả lời</span>}</div><p>{item.prompt}</p><div className="result-answer-row"><span>Bạn chọn: <b>{userAnswer || 'Chưa trả lời'}</b></span>{item.answer && <span>Đáp án gốc: <b>{item.answer}</b></span>}</div>{solution && <div className="ai-solution-inline"><div className="ai-solution-head"><Sparkles size={16}/><b>Gia sư AI {solution.provider ? `· ${solution.provider}` : ''}</b></div>{solution.answer && <p><b>AI gợi ý: {solution.answer}</b></p>}<p>{solution.explanation}</p></div>}<div className="single-ai-ask"><input aria-label={`Câu hỏi thêm cho AI về câu ${item.number}`} value={showAiAsk === item.id ? aiQuestion : ''} onFocus={() => setShowAiAsk(item.id)} onChange={(event) => { setShowAiAsk(item.id); setAiQuestion(event.target.value); }} placeholder="Bạn chưa hiểu bước nào? Hỏi thêm AI…"/><button className="button-outline small" disabled={bulkLoading || loadingAi === item.id} onClick={() => void askAi(item)}>{loadingAi === item.id ? <LoaderCircle className="spin" size={13}/> : <MessageCircle size={13}/>} Hỏi AI</button></div><button className="ai-help-button" disabled={bulkLoading || loadingAi === item.id} onClick={() => { setShowAiAsk(null); setAiQuestion(''); void askAi(item); }}>{loadingAi === item.id ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>} {solution ? 'Tạo lời giải lại' : 'Xem lời giải AI'}</button></div>;})}</div><div className="result-bottom-actions"><button className="button-outline" onClick={onBack}>Quay về tổng quan</button><button className="button-primary" onClick={() => { setCurrent(0); setSectionIndex(0); setActiveSection('Tất cả'); setAnswers({}); setSubmitted(false); setTimeLeft(sectionTimed ? sectionTemplates[0].minutes * 60 : duration * 60); localStorage.removeItem(sessionKey); setSolutions(Object.fromEntries(exam.questions.filter((item) => item.aiAnswer || item.aiExplanation).map((item) => [item.id, { answer: item.aiAnswer ?? '', explanation: item.aiExplanation ?? '', confidence: item.aiConfidence, provider: item.aiProvider }]))); }}> <RefreshCw size={15}/> Làm lại đề</button></div></div>}
  </div>;
}

export default App;
