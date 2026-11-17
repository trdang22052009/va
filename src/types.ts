export type ExamType = 'TSA' | 'HSA' | 'THPT' | 'Khác';
export type QuestionType = 'single' | 'multiple' | 'short' | 'truefalse' | 'dragdrop' | 'essay';

export interface QuestionOption {
  label: string;
  text: string;
}

export interface QuestionStatement {
  label: string;
  text: string;
}

export interface Question {
  id: string;
  number: number;
  prompt: string;
  options: QuestionOption[];
  statements?: QuestionStatement[];
  type: QuestionType;
  answer: string | null;
  explanation?: string;
  subject?: string;
  section?: string;
  aiAnswer?: string;
  aiExplanation?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
  aiProvider?: string;
}

export interface Exam {
  id: string;
  title: string;
  examType: ExamType;
  subject?: string;
  fileName: string;
  createdAt: string;
  questions: Question[];
}

export interface Attempt {
  id: string;
  examId: string;
  examTitle: string;
  completedAt: string;
  total: number;
  correct: number;
  unanswered: number;
  graded?: number;
  accuracy?: number;
  durationSeconds?: number;
  score?: number;
  maxScore?: number;
}

export interface AISolution {
  answer: string;
  explanation: string;
  confidence?: string;
  provider?: string;
  model?: string;
}
