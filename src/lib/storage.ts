import type { Attempt, Exam } from '../types';

const EXAMS_KEY = 'onthi-ai-exams-v1';
const ATTEMPTS_KEY = 'onthi-ai-attempts-v1';

export function loadExams(): Exam[] {
  try {
    return JSON.parse(localStorage.getItem(EXAMS_KEY) ?? '[]') as Exam[];
  } catch {
    return [];
  }
}

export function saveExams(exams: Exam[]): void {
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}

export function loadAttempts(): Attempt[] {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '[]') as Attempt[];
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: Attempt): void {
  const attempts = [attempt, ...loadAttempts()].slice(0, 100);
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}
