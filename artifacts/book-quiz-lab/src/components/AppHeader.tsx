import { Link, useLocation } from "wouter";
import { BookOpen } from "lucide-react";

const TABS: Array<{ path: string; label: string }> = [
  { path: "/", label: "챕터 자료 (4종)" },
  { path: "/oral-quiz", label: "구두질문지 (책 전체)" },
];

export function AppHeader() {
  const [location] = useLocation();
  return (
    <header className="bg-[#1a2e5a] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#c9a227] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[#1a2e5a]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-none truncate">헬로펀키즈 주니어 어학원</h1>
            <p className="text-xs text-white/70 mt-0.5 truncate">Book Quiz Lab · AI 시험지 자동 생성</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map((t) => {
            const active = location === t.path;
            return (
              <Link
                key={t.path}
                href={t.path}
                className={
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                  (active
                    ? "bg-[#c9a227] text-[#1a2e5a]"
                    : "text-white/80 hover:text-white hover:bg-white/10")
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
