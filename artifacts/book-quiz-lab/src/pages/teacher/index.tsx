import { TeacherLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { BookText, GraduationCap, Trophy, Users, Loader2 } from "lucide-react";

export default function TeacherDashboard() {
  const { data: stats, isLoading } = useGetStatsSummary();

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-1">대시보드</h1>
          <p className="text-muted-foreground">학생 활동 및 성적 현황을 확인합니다.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">전체 학생 수</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.totalStudents || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">명</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">등록된 교재</CardTitle>
              <BookText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.totalBooks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">권</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">전체 제출 횟수</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.totalSubmissions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">회</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">평균 점수</CardTitle>
              <Trophy className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{Math.round(stats?.averageScore || 0)}%</div>
              <p className="text-xs text-muted-foreground mt-1">전체 평균</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-primary">최근 제출 내역</h2>
          <Card>
            {!stats?.recentSubmissions?.length ? (
              <div className="p-8 text-center text-muted-foreground">아직 제출된 퀴즈가 없습니다.</div>
            ) : (
              <div className="divide-y">
                {stats.recentSubmissions.map((sub) => {
                  const pct = Math.round((sub.totalScore / (sub.totalPossible || 1)) * 100);
                  return (
                    <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-primary">{sub.studentName}</p>
                        <p className="text-sm text-muted-foreground">{sub.bookTitle} · {sub.chapterTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-accent">{pct}%</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.totalScore} / {sub.totalPossible} · {new Date(sub.submittedAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </TeacherLayout>
  );
}
