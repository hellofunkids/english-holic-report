import { Link } from "wouter";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="max-w-xl w-full flex flex-col items-center space-y-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg">
            <BookOpen className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight">Book Quiz Lab</h1>
          <p className="text-muted-foreground text-lg">원서 리딩 퀴즈를 시작해 보세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <Link href="/student" className="block outline-none">
            <Card className="flex flex-col items-center justify-center p-10 hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-accent cursor-pointer group hover:-translate-y-1 bg-white h-full">
              <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">학생 모드</h2>
              <p className="text-muted-foreground font-medium">퀴즈 풀기</p>
            </Card>
          </Link>

          <Link href="/teacher" className="block outline-none">
            <Card className="flex flex-col items-center justify-center p-10 hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary cursor-pointer group hover:-translate-y-1 bg-white h-full">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">선생님 모드</h2>
              <p className="text-muted-foreground font-medium">관리 및 결과 확인</p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
