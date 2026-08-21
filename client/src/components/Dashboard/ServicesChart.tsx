import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { ServiceDistributionItem } from '../../types/dashboard';

interface ServicesChartProps {
  data: ServiceDistributionItem[];
}

const SERVICE_COLORS = [
  '#0D9488', // Teal
  '#0F172A', // Navy
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#64748B', // Slate
];

export const ServicesChart: React.FC<ServicesChartProps> = ({ data }) => {
  const chartData = data.map((item, index) => ({
    name: item.serviceType,
    value: item.clientCount,
    percentage: item.percentage,
    color: SERVICE_COLORS[index % SERVICE_COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg border border-slate-800 text-xs">
          <p className="font-bold text-slate-200">{item.name}</p>
          <p className="text-teal-400 mt-1">
            {item.value} {item.value === 1 ? 'cliente' : 'clientes'} ({item.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div className="mb-4">
        <h2 className="text-base font-bold text-navy-900">
          Distribuição por serviço
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Participação de clientes ativos por tipo de contrato
        </p>
      </div>

      {data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-slate-500">
          Nenhum contrato ativo cadastrado
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          {/* Donut Chart */}
          <div className="sm:col-span-5 h-[200px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda com percentuais */}
          <div className="sm:col-span-7 space-y-2">
            {chartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-800 truncate" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-slate-500 font-mono text-[11px]">
                    {item.value} {item.value === 1 ? 'cli' : 'clis'}
                  </span>
                  <span className="font-bold text-slate-900  tabular-nums w-9 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
