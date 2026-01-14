
import React, { useState } from 'react';
import { X, Flag, AlertTriangle, ShieldAlert, Ban, Info, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetId }) => {
  const { t } = useLanguage();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const reasons = [
    { id: 'misinfo', icon: AlertTriangle, label: 'report.reason.misinfo', color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'hate', icon: ShieldAlert, label: 'report.reason.hate', color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'scam', icon: Ban, label: 'report.reason.scam', color: 'text-gray-600', bg: 'bg-gray-50' },
    { id: 'prohibited', icon: Info, label: 'report.reason.prohibited', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'sensitive', icon: Flag, label: 'report.reason.sensitive', color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  const handleSubmit = () => {
    if (!selectedReason) return;
    // Simulate API call to reporting backend
    console.log(`Reported target ${targetId} for reason ${selectedReason}`);
    setIsSubmitted(true);
    setTimeout(() => {
        setIsSubmitted(false);
        setSelectedReason(null);
        onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{t('report.title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={32} />
                </div>
                <p className="font-medium text-gray-900">{t('report.success')}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4 font-medium">{t('report.reason')}</p>
              <div className="space-y-2">
                {reasons.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      selectedReason === reason.id
                        ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500'
                        : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${reason.bg} ${reason.color}`}>
                        <reason.icon size={18} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{t(reason.label)}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedReason}
                className="w-full mt-6 bg-gray-900 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-200 disabled:text-gray-400 transition-all active:scale-[0.98]"
              >
                {t('report.submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
