import React from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, LayoutDashboard, BookText, BarChart3, Menu, X } from "lucide-react";
import { useState } from "react";

export function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <BookOpen className="w-6 h-6" />
            <span className="font-bold text-lg">Book Quiz Lab</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

const navItems = [
  { href: "/teacher", label: "대시보드", icon: LayoutDashboard },
  { href: "/teacher/books", label: "교재 관리", icon: BookText },
  { href: "/teacher/results", label: "결과 확인", icon: BarChart3 },
];

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-primary text-primary-foreground flex-col hidden md:flex">
        <div className="p-6 border-b border-white/10">
          <Link href="/teacher" className="flex items-center gap-2 text-white hover:text-accent transition-colors">
            <BookOpen className="w-6 h-6" />
            <span className="font-bold text-xl">선생님 모드</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href !== "/teacher" && location.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                  active ? "bg-accent text-primary" : "hover:bg-white/10 text-white/90"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <BookOpen className="w-4 h-4" />
            홈으로 돌아가기
          </Link>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-primary text-white flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <span className="font-bold text-xl">선생님 모드</span>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 text-sm font-medium"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="h-16 border-b bg-white flex items-center px-4 md:hidden shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="mr-3">
            <Menu className="w-6 h-6 text-primary" />
          </button>
          <Link href="/teacher" className="font-bold text-primary text-lg">선생님 모드</Link>
        </header>
        <div className="flex-1 p-5 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
