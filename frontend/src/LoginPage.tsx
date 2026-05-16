import React from 'react';

const LoginPage = ({ onNavigate }: { onNavigate?: (path: string) => void }) => {
  const goTo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.href = path;
  };
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col text-white overflow-hidden">
      
      {/* Header: Top Right Buttons */}
      <header className="absolute top-0 right-0 p-6 z-20 w-full flex justify-end items-center">
        <div className="flex gap-4">
          <button onClick={() => goTo('/login')} className="px-5 py-2.5 font-medium text-gray-300 hover:text-white transition-colors duration-200">
            Login
          </button>
          <button onClick={() => goTo('/login')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all duration-200 transform hover:scale-105 active:scale-95">
            Invigilator Access
          </button>
        </div>
      </header>

      {/* Main Content: Centered Overview */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl space-y-8">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
            <span className="block text-white drop-shadow-sm">Build the future</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mt-2">
              One line at a time.
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed font-light">
            Experience a platform designed for speed and scalability. 
            Collaborate with your team in real-time and ship products faster than ever before.
          </p>
          
          {/* Optional Center Call to Action */}
          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
             <button className="px-8 py-3.5 bg-white text-slate-900 font-bold rounded-full hover:bg-gray-100 transition-colors duration-200 shadow-xl">
               Get Started
             </button>
             <button className="px-8 py-3.5 border border-gray-500 text-gray-300 font-semibold rounded-full hover:bg-white/10 hover:text-white transition-colors duration-200">
               View Demo
             </button>
          </div>
        </div>
      </main>

      {/* Decorative Background Elements (Blurry Blobs) */}
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default LoginPage;