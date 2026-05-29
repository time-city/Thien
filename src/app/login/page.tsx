"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth";
import { User, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result && "error" in result && result.error) {
      setError(result.error as string);
    }

    setIsPending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Đăng nhập hệ thống</h1>
          <p className="text-sm text-slate-500 mt-2">Trung tâm Gia sư</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Tên đăng nhập</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                name="username"
                required
                disabled={isPending}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-60 transition-all"
                placeholder="Nhập tên đăng nhập..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                name="password"
                required
                disabled={isPending}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-60 transition-all"
                placeholder="Nhập mật khẩu..."
              />
            </div>
          </div>

          <div className="flex items-center pt-1">
            <input
              type="checkbox"
              id="remember"
              name="remember"
              value="true"
              disabled={isPending}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60 cursor-pointer"
            />
            <label htmlFor="remember" className="ml-2.5 text-sm text-slate-600 cursor-pointer select-none">
              Lưu đăng nhập
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

