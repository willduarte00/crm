import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  sliceNumber: number;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  sliceNumber,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center max-w-2xl mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
          <Construction className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-navy-900">Módulo em Desenvolvimento</h2>
        <p className="text-sm text-slate-500 mt-2">
          Esta funcionalidade será entregue na <span className="font-semibold text-teal-700">Fatia {sliceNumber}</span> do plano de implementação.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">
          Base e permissões ativas (Fatia 1)
        </div>
      </div>
    </div>
  );
};
