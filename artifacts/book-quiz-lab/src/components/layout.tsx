import React from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";

export function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
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

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex bg-slate-50">
      <aside className="w-64 bg-primary text-primary-foreground flex flex-col hidden md:flex">
        <div className="p-6">
          <Link href="/teacher" className="flex items-center gap-2 text-white hover:text-accent transition-colors">
            <BookOpen className="w-6 h-6" />
            <span className="font-bold text-xl">Teacher Lab</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/teacher" className="block px-4 py-3 rounded-md hover:bg-white/10 transition-colors">
            Dashboard
          </Link>
          <Link href="/teacher/books" className="block px-4 py-3 rounded-md hover:bg-white/10 transition-colors">
            Manage Books
          </Link>
          <Link href="/teacher/results" className="block px-4 py-3 rounded-md hover:bg-white/10 transition-colors">
            Results
          </Link>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-white flex items-center px-6 md:hidden">
          <Link href="/teacher" className="font-bold text-primary text-lg">Teacher Lab</Link>
        </header>
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
