export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  packetId?: string;
  booklet?: string;
}

export interface QuestionBankItem {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  packetId: string;
  booklet?: string;
}

export interface Campaign {
  id: string;
  name: string;
  groupName: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  startTime: string | null;
  endTime: string | null;
  passingPercentage: number;
  timeLimitMinutes: number;
  totalQuestionsToTest?: number;
  maxAttempts?: number;
  resultsDisplayMode?: string;
  isUntimed?: boolean;
  randomizationMode?: string;
  questions: Question[];
  createdAt: string;
  questionSelectionMode?: 'manual' | 'random' | 'rule';
  manualQuestionIds?: string[];
  ruleCategory?: string;
  ruleDifficulty?: string;
  ruleCount?: number;
  targetBooklet?: string;
  activeTakersCount?: number;
}

export interface Submission {
  id?: number;
  userName: string;
  userIdentifier: string;
  department?: string;
  surname?: string;
  emNo?: string;
  companyEmail?: string;
  company?: string;
  score: number; // percentage
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  submittedAt: string;
  durationSeconds: number;
  answers: Record<string, string>; // Maps question ID -> selected option text
}

export interface CustomAlertOptions {
  title?: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  onClose?: () => void;
}

declare global {
  interface Window {
    showCustomAlert?: (options: string | CustomAlertOptions) => Promise<void>;
    showCustomConfirm?: (title: string, message: string) => Promise<boolean>;
    showCustomPrompt?: (message: string, defaultValue?: string) => Promise<string | null>;
  }
}

