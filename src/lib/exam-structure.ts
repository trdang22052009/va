import type { Exam, Question } from '../types';

export interface ExamSection {
  id: string;
  name: string;
  minutes: number;
  points: number;
  guidance: string;
}

export function getExamSections(exam: Pick<Exam, 'examType' | 'subject'>): ExamSection[] {
  if (exam.examType === 'TSA') return [
    { id: 'tsa-math', name: 'Tư duy Toán học', minutes: 60, points: 40, guidance: 'Phân tích, mô hình hóa và giải quyết vấn đề bằng Toán học.' },
    { id: 'tsa-reading', name: 'Tư duy Đọc hiểu', minutes: 30, points: 20, guidance: 'Đọc văn bản, xác định thông tin, lập luận và suy luận.' },
    { id: 'tsa-science', name: 'Tư duy Khoa học / Giải quyết vấn đề', minutes: 60, points: 40, guidance: 'Phân tích dữ liệu, biểu đồ, thí nghiệm và tình huống khoa học.' },
  ];
  if (exam.examType === 'HSA') return [
    { id: 'hsa-quant', name: 'Toán học và xử lý số liệu', minutes: 75, points: 50, guidance: '50 câu; có trắc nghiệm và điền đáp án.' },
    { id: 'hsa-language', name: 'Văn học – Ngôn ngữ', minutes: 60, points: 50, guidance: '50 câu đọc hiểu và sử dụng ngôn ngữ.' },
    { id: 'hsa-choice', name: exam.subject === 'Tiếng Anh' ? 'Tiếng Anh' : 'Khoa học / Tiếng Anh tự chọn', minutes: 60, points: 50, guidance: 'Phần lựa chọn theo cấu trúc đề được tải lên.' },
  ];
  if (exam.examType === 'THPT') {
    const subject = exam.subject || 'Môn trắc nghiệm';
    const minutes = subject === 'Ngữ văn' ? 120 : subject === 'Toán' ? 90 : 50;
    return [{ id: 'thpt-main', name: subject, minutes, points: 10, guidance: subject === 'Ngữ văn' ? 'Bài thi tự luận; phiên bản này hỗ trợ phần câu hỏi đã chuyển thành dữ liệu.' : 'Mô phỏng thời gian làm bài theo môn.' }];
  }
  return [{ id: 'practice', name: 'Phần luyện tập', minutes: 60, points: 100, guidance: 'Thời gian mặc định có thể điều chỉnh theo đề.' }];
}

export function getSuggestedDuration(exam: Pick<Exam, 'examType' | 'subject'>): number {
  return getExamSections(exam).reduce((sum, section) => sum + section.minutes, 0);
}

export function getQuestionSectionName(question: Question, exam: Pick<Exam, 'examType' | 'subject'>, index: number, total: number): string {
  if (question.section?.trim()) return question.section.trim();
  if (exam.examType === 'TSA' && total >= 90) {
    if (index < Math.ceil(total * 0.4)) return 'Tư duy Toán học';
    if (index < Math.ceil(total * 0.6)) return 'Tư duy Đọc hiểu';
    return 'Tư duy Khoa học / Giải quyết vấn đề';
  }
  if (exam.examType === 'HSA' && total >= 120) {
    if (index < Math.ceil(total / 3)) return 'Toán học và xử lý số liệu';
    if (index < Math.ceil((total * 2) / 3)) return 'Văn học – Ngôn ngữ';
    return exam.subject === 'Tiếng Anh' ? 'Tiếng Anh' : 'Khoa học / Tiếng Anh tự chọn';
  }
  return exam.subject || 'Phần luyện tập';
}

