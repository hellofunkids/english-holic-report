import React, { createContext, useContext, useState, ReactNode } from "react";
import { AnswerInput, Submission } from "@workspace/api-client-react";

interface QuizState {
  studentName: string;
  bookId: number | null;
  chapterId: number | null;
  answers: AnswerInput[];
  submissionResult: Submission | null;
}

interface QuizContextType {
  state: QuizState;
  setStudentName: (name: string) => void;
  setBookAndChapter: (bookId: number, chapterId: number) => void;
  addAnswer: (answer: AnswerInput) => void;
  setSubmissionResult: (result: Submission) => void;
  resetQuiz: () => void;
}

const initialState: QuizState = {
  studentName: "",
  bookId: null,
  chapterId: null,
  answers: [],
  submissionResult: null,
};

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuizState>(initialState);

  const setStudentName = (name: string) => {
    setState((s) => ({ ...s, studentName: name }));
  };

  const setBookAndChapter = (bookId: number, chapterId: number) => {
    setState((s) => ({ ...s, bookId, chapterId, answers: [], submissionResult: null }));
  };

  const addAnswer = (answer: AnswerInput) => {
    setState((s) => {
      const existing = s.answers.findIndex((a) => a.questionId === answer.questionId && a.questionType === answer.questionType);
      if (existing >= 0) {
        const newAnswers = [...s.answers];
        newAnswers[existing] = answer;
        return { ...s, answers: newAnswers };
      }
      return { ...s, answers: [...s.answers, answer] };
    });
  };

  const setSubmissionResult = (result: Submission) => {
    setState((s) => ({ ...s, submissionResult: result }));
  };

  const resetQuiz = () => {
    setState(initialState);
  };

  return (
    <QuizContext.Provider
      value={{
        state,
        setStudentName,
        setBookAndChapter,
        addAnswer,
        setSubmissionResult,
        resetQuiz,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuizContext() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuizContext must be used within a QuizProvider");
  }
  return context;
}
