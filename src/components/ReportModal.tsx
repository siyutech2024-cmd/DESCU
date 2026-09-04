
import React, { useState } from 'react';
import { Flag, AlertTriangle, ShieldAlert, Ban, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { notify } from '@/lib/toast';
import { submitReport, type ReportReason, type ReportTargetType } from '@/services/moderationService';
import { Sheet } from './ui/Sheet';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What is being reported. Defaults to `'user'`. */
  targetType?: ReportTargetType;
  /** Id of the reported user / product / message / conversation. */
  targetId: string;
}

const REASONS: { id: ReportReason; icon: React.ElementType; label: string; color: string; bg: string }[] = [
  { id: 'misinfo', icon: AlertTriangle, label: 'report.reason.misinfo', color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'hate', icon: ShieldAlert, label: 'report.reason.hate', color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'scam', icon: Ban, label: 'report.reason.scam', color: 'text-gray-600', bg: 'bg-gray-50' },
  { id: 'prohibited', icon: Info, label: 'report.reason.prohibited', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'sensitive', icon: Flag, label: 'report.reason.sensitive', color: 'text-purple-600', bg: 'bg-purple-50' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetType = 'user', targetId }) => {
  const { t } = useLanguage();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setIsSubmitted(false);
    setSelectedReason(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await submitReport({ target_type: targetType, target_id: targetId, reason: selectedReason });
      if (result?.duplicate) {
        notify.info(t('chat.report_duplicate'));
      }
      setIsSubmitted(true);
      setTimeout(() => {
        reset();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('[report] submit failed:', error);
      notify.error(t('chat.report_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onClose={handleClose} size="sm" title={t('report.title')} closeLabel={t('chat.cancel')}>
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
            {REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedReason(reason.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:opacity-60 ${selectedReason === reason.id
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
            type="button"
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            className="w-full mt-6 bg-gray-900 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-200 disabled:text-gray-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {t('report.submit')}
          </button>
        </>
      )}
    </Sheet>
  );
};
