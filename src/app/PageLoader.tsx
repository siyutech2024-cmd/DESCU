import React from 'react';

export const PageLoader: React.FC = () => (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
    </div>
);
