import { TeacherLayout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetLeaderboard, useListSubmissions } from "@workspace/api-client-react";
import { Loader2, Trophy, Medal } from "lucide-react";

export default function TeacherResults() {
  const { data: submissions, isLoading: isLoadingSubmissions } = useListSubmissions();
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useGetLeaderboard();

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Results & Leaderboard</h1>
          <p className="text-muted-foreground">View detailed student performance and rankings.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Leaderboard Panel */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" /> Leaderboard
            </h2>
            <Card className="border-2 border-accent/20 overflow-hidden">
              <div className="bg-accent/10 p-4 border-b border-accent/20">
                <p className="text-sm font-bold text-accent text-center uppercase tracking-wider">Top Students</p>
              </div>
              <div className="p-0">
                {isLoadingLeaderboard ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
                ) : !leaderboard?.length ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No data available yet.</div>
                ) : (
                  <div className="divide-y">
                    {leaderboard.map((entry, idx) => (
                      <div key={entry.studentName} className={`p-4 flex items-center gap-4 ${idx < 3 ? 'bg-accent/5' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                          ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 
                            idx === 1 ? 'bg-slate-300 text-slate-800' : 
                            idx === 2 ? 'bg-amber-600 text-amber-100' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-primary truncate">{entry.studentName}</p>
                          <p className="text-xs text-muted-foreground">{entry.submissionCount} quizzes completed</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-accent text-lg">{Math.round(entry.averageScore)}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Average</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Submissions Table */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-primary">All Submissions</h2>
            <Card>
              {isLoadingSubmissions ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : !submissions?.length ? (
                <div className="p-12 text-center text-muted-foreground">No submissions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Book & Chapter</TableHead>
                        <TableHead className="text-center">Vocab</TableHead>
                        <TableHead className="text-center">Quiz</TableHead>
                        <TableHead className="text-right">Total Score</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((sub) => {
                        const scorePercent = Math.round((sub.totalScore / (sub.totalPossible || 1)) * 100);
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-bold text-primary">{sub.studentName}</TableCell>
                            <TableCell>
                              <p className="font-medium">{sub.bookTitle}</p>
                              <p className="text-xs text-muted-foreground">{sub.chapterTitle}</p>
                            </TableCell>
                            <TableCell className="text-center text-sm">{sub.vocabScore}/{sub.vocabTotal}</TableCell>
                            <TableCell className="text-center text-sm">{sub.quizScore}/{sub.quizTotal}</TableCell>
                            <TableCell className="text-right">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                scorePercent >= 90 ? 'bg-green-100 text-green-800' :
                                scorePercent >= 70 ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {scorePercent}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
