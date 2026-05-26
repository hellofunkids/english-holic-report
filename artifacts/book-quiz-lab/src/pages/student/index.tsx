import { useState } from "react";
import { useLocation } from "wouter";
import { StudentLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuizContext } from "@/lib/quiz-store";
import { UserCircle } from "lucide-react";

export default function StudentHome() {
  const [, setLocation] = useLocation();
  const { state, setStudentName } = useQuizContext();
  const [name, setName] = useState(state.studentName || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setStudentName(name.trim());
      setLocation("/student/select");
    }
  };

  return (
    <StudentLayout>
      <div className="flex flex-col items-center justify-center py-12 md:py-24 max-w-md mx-auto">
        <div className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mb-8">
          <UserCircle className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-bold text-primary mb-2 text-center">환영합니다!</h1>
        <p className="text-muted-foreground mb-8 text-center">퀴즈를 시작하기 위해 이름을 입력해주세요.</p>

        <Card className="w-full p-6 sm:p-8 border-2 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="student-name" className="text-lg font-semibold text-primary block">
                학생 이름
              </label>
              <Input
                id="student-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="h-14 text-lg px-4 border-2 focus-visible:ring-accent"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={!name.trim()}
            >
              다음으로
            </Button>
          </form>
        </Card>
      </div>
    </StudentLayout>
  );
}
