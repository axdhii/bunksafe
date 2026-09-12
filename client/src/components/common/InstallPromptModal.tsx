import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, PlusSquare, X, Smartphone, Download } from 'lucide-react';

export const InstallPromptModal: React.FC = () => {
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already dismissed or already running as standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isDismissed = localStorage.getItem('aurora_pwa_dismissed');

    if (isStandalone || isDismissed) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIos && isSafari) {
      // Delay prompt slightly so it doesn't disrupt immediate first impression
      const timer = setTimeout(() => setShowIosPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('aurora_pwa_dismissed', 'true');
    setShowIosPrompt(false);
    setDeferredPrompt(null);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('aurora_pwa_dismissed', 'true');
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {/* iOS Safari Installation Bottom Sheet */}
      <AnimatePresence>
        {showIosPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50 rounded-2xl liquid-glass-card border border-white/15 p-4 shadow-2xl backdrop-blur-2xl text-zinc-100 font-sans"
          >
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/10">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-sans">Install on iPhone</h4>
                  <p className="text-xs text-zinc-400 font-sub font-light">Install for full-screen and offline access</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-zinc-300 bg-white/5 p-3 rounded-xl border border-white/5 font-sub">
              <div className="flex items-center gap-2">
                <span className="font-sans font-bold text-white">1.</span>
                <span>Tap the</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 font-medium text-white">
                  <Share className="w-3.5 h-3.5" /> Share
                </span>
                <span>button in Safari below</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-bold text-white">2.</span>
                <span>Scroll down and select</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 font-medium text-white">
                  <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                </span>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-3 w-full py-2 text-center text-xs font-medium text-zinc-400 hover:text-white font-sub"
            >
              Maybe later
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Android Native PWA Banner */}
      <AnimatePresence>
        {deferredPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50 rounded-2xl liquid-glass-card border border-white/15 p-4 shadow-2xl backdrop-blur-2xl text-zinc-100 flex items-center justify-between gap-3 font-sans"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/5 text-white border border-white/10">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-sans">Install App</h4>
                <p className="text-xs text-zinc-400 font-sub font-light">Fast access & daily attendance tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 active:scale-95 transition-all font-sans"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
