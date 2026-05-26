import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import StudentHome from "./pages/student/index";
import StudentSelect from "./pages/student/select";
import StudentQuiz from "./pages/student/quiz";
import StudentResult from "./pages/student/result";
import TeacherDashboard from "./pages/teacher/index";
import TeacherBooks from "./pages/teacher/books";
import TeacherContent from "./pages/teacher/content";
import TeacherResults from "./pages/teacher/results";

import { QuizProvider } from "./lib/quiz-store";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/student" component={StudentHome} />
      <Route path="/student/select" component={StudentSelect} />
      <Route path="/student/quiz" component={StudentQuiz} />
      <Route path="/student/result" component={StudentResult} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/teacher/books" component={TeacherBooks} />
      <Route path="/teacher/content/:chapterId" component={TeacherContent} />
      <Route path="/teacher/results" component={TeacherResults} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QuizProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </QuizProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
