import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  category?: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  category,
  title,
  subtitle,
  backTo,
  actions,
  children,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06] mb-6">
      <div className="flex items-start gap-3">
        {/* Universal Back Button */}
        <button
          onClick={handleBack}
          className="mt-0.5 p-2 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-90 flex items-center gap-1 group shrink-0"
          title="Go back to previous page"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-xs font-semibold hidden md:inline">Back</span>
        </button>

        <div>
          {category && (
            <span className="text-[11px] font-sub uppercase tracking-wider text-zinc-400 block font-normal">
              {category}
            </span>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-0.5 font-sans">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 font-sub mt-0.5 max-w-2xl font-light">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {(actions || children) && (
        <div className="flex items-center gap-2 self-start sm:self-auto">{actions || children}</div>
      )}
    </div>
  );
};
