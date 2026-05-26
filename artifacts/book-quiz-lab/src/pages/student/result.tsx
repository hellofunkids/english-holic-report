import { useLocation } from "wouter";
import { StudentLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuizContext } from "@/lib/quiz-store";
import { CheckCircle2, XCircle, Trophy, Home } from "lucide-react";
import { motion } from "framer-motion";

export default function StudentResult() {
  const [, setLocation] = useLocation();
  const { state, resetQuiz } = useQuizContext();
  const { submissionResult, studentName } = state;

  if (!submissionResult || !studentName) {
    setLocation("/student");
    return null;
  }

  const handleFinish = () => {
    resetQuiz();
    setLocation("/");
  };

  const percentScore = Math.round((submissionResult.totalScore / (submissionResult.totalPossible || 1)) * 100);

  return (
    <StudentLayout>
      <div className="max-w-3xl mx-auto py-8 space-y-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4 py-8"
        >
          <div className="w-24 h-24 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Trophy className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-primary">수고하셨습니다, {studentName} 학생!</h1>
          <p className="text-xl text-muted-foreground font-medium">
            총점: <span className="text-accent font-bold text-3xl">{submissionResult.totalScore}</span> / {submissionResult.totalPossible}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 text-center border-2 border-primary/10">
            <h3 className="font-bold text-lg text-primary mb-2">어휘 퀴즈</h3>
            <p className="text-3xl font-black text-accent">{submissionResult.vocabScore} <span className="text-base font-normal text-muted-foreground">/ {submissionResult.vocabTotal}</span></p>
          </Card>
          <Card className="p-6 text-center border-2 border-primary/10">
            <h3 className="font-bold text-lg text-primary mb-2">이해력 퀴즈</h3>
            <p className="text-3xl font-black text-accent">{submissionResult.quizScore} <span className="text-base font-normal text-muted-foreground">/ {submissionResult.quizTotal}</span></p>
          </Card>
        </div>

        {submissionResult.answers && submissionResult.answers.length > 0 && (
          <div className="space-y-6 mt-12">
            <h2 className="text-2xl font-bold text-primary border-b pb-4">퀴즈 결과 상세</h2>
            
            <div className="space-y-4">
              {submissionResult.answers.map((answer, idx) => (
                <Card key={idx} className={`p-5 border-2 ${answer.isCorrect ? 'border-green-500/20 bg-green-50/50' : 'border-red-500/20 bg-red-50/50'}`}>
                  <div className="flex gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {answer.isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-lg whitespace-pre-wrap">{answer.question || "질문 정보 없음"}</p>
                      
                      <div className="grid sm:grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/80 p-3 rounded-lg border">
                          <span className="text-xs font-bold text-muted-foreground uppercase mb-1 block">나의 답</span>
                          <span className={answer.isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium line-through"}>
                            {answer.studentAnswer}
                          </span>
                        </div>
                        
                        {!answer.isCorrect && (
                          <div className="bg-white/80 p-3 rounded-lg border border-green-200">
                            <span className="text-xs font-bold text-green-700 uppercase mb-1 block">정답</span>
                            <span className="text-green-700 font-bold">{answer.correctAnswer}</span>
                          </div>
                        )}
                      </div>

                      {answer.explanation && (
                        <div className="mt-4 text-sm text-muted-foreground bg-white/50 p-3 rounded-lg">
                          <span className="font-bold mr-2">해설:</span>
                          {answer.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="pt-8 flex justify-center">
          <Button size="lg" className="h-16 px-12 text-lg rounded-xl" onClick={handleFinish}>
            <Home className="mr-2 w-5 h-5" />
            처음으로 돌아가기
          </Button>
        </div>
      </div>
    </StudentLayout>
  );
}
