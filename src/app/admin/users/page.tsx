"use client";

import { useAuth } from '@/lib/AuthContext';
import { mockUsers } from '@/lib/mock-data';
import { useState } from 'react';
import { UserPlus, Shield } from 'lucide-react';

export default function UserManagementPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState(mockUsers);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subjects, setSubjects] = useState('');

  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không có quyền truy cập trang này. Chỉ Super Admin được phép.
      </div>
    );
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser = {
      id: `u${users.length + 1}`,
      username,
      name,
      role: 'TEACHER' as const,
      status: 'ACTIVE' as const,
      subjects: subjects.split(',').map(s => s.trim()).filter(Boolean)
    };
    setUsers([...users, newUser]);
    setShowModal(false);
    setName('');
    setUsername('');
    setPassword('');
    setSubjects('');
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Shield className="text-blue-600" />
            Quản Lý Tài Khoản (Kín)
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Độc quyền Super Admin tạo tài khoản cho giáo viên mới.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors text-sm"
        >
          <UserPlus size={16} />
          Tạo tài khoản
        </button>
      </div>

      <div className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900">
            <tr>
              <th className="py-3 px-4 font-bold">Giảng viên</th>
              <th className="py-3 px-4 font-bold">Tên đăng nhập</th>
              <th className="py-3 px-4 font-bold">Môn dạy</th>
              <th className="py-3 px-4 font-bold">Role</th>
              <th className="py-3 px-4 font-bold text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 font-bold text-slate-900">{user.name}</td>
                <td className="py-3 px-4 text-slate-500 font-mono">@{user.username}</td>
                <td className="py-3 px-4">
                  {user.subjects.length > 0 ? user.subjects.join(', ') : <span className="text-slate-400 italic">Trống</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${
                    user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Tạo Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Tạo tài khoản Giảng viên</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-4 md:p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Họ và Tên</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                  placeholder="Ví dụ: Thầy Hùng" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tên đăng nhập (Username)</label>
                <input required type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                  placeholder="Ví dụ: hung" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
                <input required type="text" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                  placeholder="Mật khẩu tạm..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Môn dạy (Cách nhau dấu phẩy)</label>
                <input type="text" value={subjects} onChange={e => setSubjects(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100" 
                  placeholder="Toán, Lý, Hóa" />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">
                  Hủy
                </button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
                  Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}