// Toast通知工具函数
import toast from 'react-hot-toast';

export const showToast = {
    success: (message: string) => {
        toast.success(message, {
            duration: 3000,
            position: 'top-right',
            style: {
                background: '#10B981',
                color: '#fff',
                padding: '16px',
                borderRadius: '8px',
            },
        });
    },

    error: (message: string) => {
        toast.error(message, {
            duration: 4000,
            position: 'top-right',
            style: {
                background: '#EF4444',
                color: '#fff',
                padding: '16px',
                borderRadius: '8px',
            },
        });
    },

    loading: (message: string) => {
        return toast.loading(message, {
            position: 'top-right',
            style: {
                background: '#3B82F6',
                color: '#fff',
                padding: '16px',
                borderRadius: '8px',
            },
        });
    },

    promise: <T,>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string;
            error: string;
        }
    ) => {
        return toast.promise(
            promise,
            {
                loading: messages.loading,
                success: messages.success,
                error: messages.error,
            },
            {
                position: 'top-right',
                style: {
                    padding: '16px',
                    borderRadius: '8px',
                },
            }
        );
    },
};
