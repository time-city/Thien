'use client';

import React, { useState, useEffect, useRef } from 'react';
import { markReportAsSent } from "@/actions/mutations";

export interface StudentTarget {
  attendanceLogId: string;
  phone: string;
  name: string;
}

interface Props {
  selectedStudents: StudentTarget[];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function ZaloBulkReportSender({ selectedStudents }: Props) {
  const [activeTab, setActiveTab] = useState<'connection' | 'send'>('connection');
  
  // Bot Status States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Đang kiểm tra trạng thái...');
  
  // Send Image Logic States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('Gửi phụ huynh báo cáo học tập của bé');
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<Record<string, 'pending' | 'sending' | 'success' | 'error'>>({});
  const [sentCount, setSentCount] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize status for newly added students
  useEffect(() => {
    const initialStatus: Record<string, 'pending' | 'sending' | 'success' | 'error'> = {};
    selectedStudents.forEach(student => {
      if (!sendResults[student.phone]) {
        initialStatus[student.phone] = 'pending';
      }
    });
    if (Object.keys(initialStatus).length > 0) {
      setSendResults(prev => ({ ...initialStatus, ...prev }));
    }
  }, [selectedStudents]);

  const checkStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/status');
      const data = await response.json().catch(() => null);
      
      // Adapt to possible API response structures
      const isConnected = data?.isLoggedIn || data?.status === 'ready' || data?.status === 'logged_in';
      
      if (isConnected) {
        setIsLoggedIn(true);
        setStatusMessage('✅ Đã kết nối thành công với Zalo Bot!');
        setActiveTab('send');
        setQrUrl(null);
      } else {
        setIsLoggedIn(false);
        setStatusMessage(data?.message || 'Chưa kết nối. Vui lòng lấy mã QR để đăng nhập.');
      }
    } catch (error) {
      setIsLoggedIn(false);
      setStatusMessage('❌ Không thể kết nối tới server Zalo Bot (http://localhost:8080)');
    }
  };

  // Initial check on mount
  useEffect(() => {
    checkStatus();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll status every 3s if QR is visible and not logged in
  useEffect(() => {
    if (qrUrl && !isLoggedIn) {
      pollIntervalRef.current = setInterval(() => {
        checkStatus();
      }, 3000);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [qrUrl, isLoggedIn]);

  const handleGetQR = () => {
    // Setting the URL directly to an img src will trigger the GET request
    setQrUrl(`http://localhost:8080/login?t=${Date.now()}`);
    setStatusMessage('Vui lòng quét mã QR trên bằng ứng dụng Zalo (hoặc Zalo Zavi) để đăng nhập.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Vui lòng chọn ảnh báo cáo!');
      return;
    }
    if (selectedStudents.length === 0) {
      alert('Danh sách học sinh trống!');
      return;
    }

    setIsSending(true);
    setSentCount(0);
    
    // Reset status for current batch
    const newStatus = { ...sendResults };
    selectedStudents.forEach(s => newStatus[s.phone] = 'pending');
    setSendResults(newStatus);

    let currentCount = 0;

    for (const student of selectedStudents) {
      // Mark as sending
      setSendResults(prev => ({ ...prev, [student.phone]: 'sending' }));
      
      const formData = new FormData();
      formData.append('target', student.phone);
      formData.append('image', selectedFile);
      formData.append('message', `${messageText} ${student.name}`);

      try {
        const res = await fetch('http://localhost:8080/send-image', {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
          setSendResults(prev => ({ ...prev, [student.phone]: 'success' }));
          await markReportAsSent(student.attendanceLogId);
        } else {
          setSendResults(prev => ({ ...prev, [student.phone]: 'error' }));
        }
      } catch (error) {
        setSendResults(prev => ({ ...prev, [student.phone]: 'error' }));
      }
      
      currentCount++;
      setSentCount(currentCount);

      // MANDATORY: Wait 3 seconds before next request to prevent rate-limiting
      if (currentCount < selectedStudents.length) {
        await sleep(3000);
      }
    }
    
    setIsSending(false);
  };

  const getStatusBadge = (phone: string) => {
    const status = sendResults[phone] || 'pending';
    switch (status) {
      case 'pending': 
        return <span className="text-slate-500 font-medium flex items-center gap-1.5 text-xs sm:text-sm"><span className="text-base">⏳</span> Chờ gửi</span>;
      case 'sending': 
        return <span className="text-blue-600 font-bold flex items-center gap-1.5 text-xs sm:text-sm animate-pulse"><span className="text-base">🔄</span> Đang gửi</span>;
      case 'success': 
        return <span className="text-green-600 font-bold flex items-center gap-1.5 text-xs sm:text-sm"><span className="text-base">✅</span> Thành công</span>;
      case 'error': 
        return <span className="text-red-600 font-bold flex items-center gap-1.5 text-xs sm:text-sm"><span className="text-base">❌</span> Thất bại</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-w-5xl mx-auto font-sans">
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm">
        <button 
          type="button"
          onClick={() => setActiveTab('connection')}
          className={`flex-1 py-4 px-2 sm:px-6 text-center font-bold text-sm sm:text-base transition-all duration-300 border-b-2 ${activeTab === 'connection' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            1. Kết nối Zalo Bot 
            {isLoggedIn && <span className="flex w-2.5 h-2.5 bg-green-500 rounded-full ml-1.5 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
          </div>
        </button>
        <button 
          type="button"
          onClick={() => isLoggedIn && setActiveTab('send')}
          disabled={!isLoggedIn}
          className={`flex-1 py-4 px-2 sm:px-6 text-center font-bold text-sm sm:text-base transition-all duration-300 border-b-2 ${!isLoggedIn ? 'opacity-40 cursor-not-allowed text-slate-400' : activeTab === 'send' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            2. Gửi Hàng Loạt
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-8">
        {activeTab === 'connection' && (
          <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-in fade-in zoom-in-95 duration-500">
            <div className={`p-5 rounded-full shadow-inner ${isLoggedIn ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              {isLoggedIn ? (
                 <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              ) : (
                 <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              )}
            </div>
            
            <div className="text-center space-y-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">{isLoggedIn ? 'Bot Đã Sẵn Sàng' : 'Kết Nối Zalo Bot'}</h3>
              <p className="text-slate-600 max-w-md mx-auto text-base sm:text-lg px-4">{statusMessage}</p>
            </div>

            {!isLoggedIn && (
              <div className="flex flex-col items-center gap-6 w-full max-w-sm mt-4 px-4">
                <button 
                  type="button"
                  onClick={handleGetQR}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/50 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                  Lấy mã QR Đăng Nhập
                </button>
                
                {qrUrl && (
                  <div className="p-5 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center gap-4 w-full animate-in zoom-in duration-300 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Quét mã bằng Zalo</p>
                    <div className="p-2 sm:p-3 bg-white border border-slate-100 shadow-sm rounded-xl">
                      <img src={qrUrl} alt="Zalo Login QR" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mt-1">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      Đang chờ xác nhận...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'send' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="mb-6">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Soạn Báo Cáo</h3>
                <p className="text-slate-500">Tùy chỉnh nội dung và hình ảnh báo cáo để gửi cho hàng loạt phụ huynh.</p>
              </div>

              <form onSubmit={handleSend} className="space-y-6">
                {/* File Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">Hình ảnh báo cáo <span className="text-red-500">*</span></label>
                  <div className={`relative flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-2xl transition-all ${filePreview ? 'border-blue-300 bg-blue-50/30' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                    {filePreview ? (
                      <div className="flex flex-col items-center w-full">
                        <img src={filePreview} alt="Preview" className="max-h-64 rounded-xl shadow-md object-contain mb-4" />
                        <span className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 cursor-pointer z-10 transition-colors">
                          Nhấn để thay đổi ảnh
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center py-8">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="flex text-sm text-slate-600 justify-center">
                          <span className="relative cursor-pointer bg-white rounded-md font-bold text-blue-600 hover:text-blue-700">
                            <span>Tải ảnh lên</span>
                          </span>
                          <p className="pl-1">hoặc kéo thả vào đây</p>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">PNG, JPG, GIF lên đến 10MB</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                      disabled={isSending}
                    />
                  </div>
                </div>

                {/* Message Input */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">Nội dung tin nhắn</label>
                  <textarea 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={isSending}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm disabled:bg-slate-100 disabled:text-slate-500 resize-none font-medium text-slate-700"
                    placeholder="Nhập nội dung tin nhắn..."
                  />
                  <div className="flex items-start gap-2 bg-blue-50/80 p-3.5 rounded-xl border border-blue-100">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                      Tên học sinh sẽ được tự động thêm vào sau nội dung này.<br/>
                      <span className="text-blue-600/80 mt-1 block">Ví dụ: "{messageText} Nguyễn Văn A"</span>
                    </p>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSending || selectedStudents.length === 0}
                  className={`w-full py-4.5 px-6 rounded-xl font-extrabold text-white text-lg flex items-center justify-center gap-3 transition-all duration-300 ${isSending || selectedStudents.length === 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]'}`}
                >
                  {isSending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Đang xử lý gửi hàng loạt... ({sentCount}/{selectedStudents.length})
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Bắt Đầu Gửi {selectedStudents.length > 0 ? selectedStudents.length : ''} Báo Cáo
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Recipients List Column */}
            <div className="lg:col-span-5 flex flex-col mt-8 lg:mt-0">
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 flex flex-col h-full lg:min-h-[500px] shadow-inner">
                <div className="flex justify-between items-end mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">Danh Sách Nhận</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1"><span className="text-blue-600 font-bold">{selectedStudents.length}</span> học sinh được chọn</p>
                  </div>
                  {isSending && (
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full animate-pulse flex items-center gap-1.5 border border-blue-200">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      Đang chạy
                    </span>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar max-h-[400px] lg:max-h-full">
                  {selectedStudents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-10">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                      </div>
                      <p className="font-medium">Chưa có học sinh nào</p>
                    </div>
                  ) : (
                    selectedStudents.map((student, idx) => {
                      const status = sendResults[student.phone] || 'pending';
                      const isProcessing = status === 'sending';
                      const isSuccess = status === 'success';
                      const isError = status === 'error';
                      
                      return (
                        <div 
                          key={`${student.phone}-${idx}`} 
                          className={`flex items-center justify-between p-3.5 rounded-xl border bg-white transition-all duration-300 ${isProcessing ? 'border-blue-400 shadow-md transform scale-[1.02] ring-1 ring-blue-400 ring-opacity-50' : isSuccess ? 'border-green-200 bg-green-50/30' : isError ? 'border-red-200 bg-red-50/30' : 'border-slate-100 shadow-sm hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold border ${isSuccess ? 'bg-green-100 text-green-700 border-green-200' : isError ? 'bg-red-100 text-red-700 border-red-200' : isProcessing ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="max-w-[130px] sm:max-w-[180px] lg:max-w-[150px]">
                              <p className="font-bold text-slate-800 text-sm truncate" title={student.name}>{student.name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{student.phone}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                            {getStatusBadge(student.phone)}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                
                {/* Custom scrollbar styles */}
                <style dangerouslySetInnerHTML={{__html: `
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                  }
                  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                  }
                `}} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
