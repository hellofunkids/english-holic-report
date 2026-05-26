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
          <h1 className="text-3xl font-bold text-primary mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of student activity and performance.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.totalStudents || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Books</CardTitle>
              <BookText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.totalBooks || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.totalSubmissions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Trophy className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{Math.round(stats?.averageScore || 0)}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-primary">Recent Submissions</h2>
          <Card>
            {!stats?.recentSubmissions?.length ? (
              <div className="p-8 text-center text-muted-foreground">No submissions yet.</div>
            ) : (
              <div className="divide-y">
                {stats.recentSubmissions.map((sub) => (
                  <div key={sub.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-primary">{sub.studentName}</p>
                      <p className="text-sm text-muted-foreground">{sub.bookTitle} - {sub.chapterTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-accent">{sub.totalScore} / {sub.totalPossible}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </TeacherLayout>
  );
}
