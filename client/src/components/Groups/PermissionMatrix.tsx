import React, { useState, useEffect } from 'react';
import { PermissionCatalog } from '../../types/permission';
import { AlertTriangle } from 'lucide-react';

interface PermissionMatrixProps {
  catalog: PermissionCatalog;
  value: string[];
  onChange: (newValue: string[]) => void;
  violations?: { screen: string; missingAnyOf: string[] }[];
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  catalog,
  value,
  onChange,
  violations = [],
}) => {
  const valueSet = new Set(value);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const togglePermission = (key: string) => {
    const next = new Set(valueSet);
    const permMeta = catalog.permissions.find(p => p.key === key);
    
    if (next.has(key)) {
      next.delete(key);
      
      const removedScreens: string[] = [];
      Object.entries(catalog.screenDependencies || {}).forEach(([screenKey, requirements]) => {
        if (next.has(screenKey)) {
          const stillHasReq = requirements.some(req => next.has(req));
          if (!stillHasReq) {
            next.delete(screenKey);
            const screenMeta = catalog.permissions.find(p => p.key === screenKey);
            removedScreens.push(screenMeta?.label || screenKey);
          }
        }
      });
      
      if (removedScreens.length > 0) {
        const screensText = removedScreens.length === 1 
          ? `A tela ${removedScreens[0]} foi desmarcada`
          : `As telas ${removedScreens.join(', ')} foram desmarcadas`;
        
        setAnnouncement(`${screensText} porque depende de ${permMeta?.label || key}`);
      }
    } else {
      next.add(key);
    }
    
    onChange(Array.from(next));
  };

  const grouped = catalog.permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof catalog.permissions>);

  const hasViolation = (key: string) => violations.some(v => v.screen === key);

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {Object.entries(grouped).map(([category, perms]) => (
        <fieldset key={category} className="border border-slate-200 rounded-md p-4 bg-slate-50/50">
          <legend className="text-sm font-semibold text-navy-900 px-2 bg-white border border-slate-200 rounded-md py-1">{category}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 mt-3">
            {perms.map(perm => {
              const reqs = catalog.screenDependencies?.[perm.key];
              let disabled = false;
              let hint = '';
              let isMissingReqs = false;
              
              if (reqs && reqs.length > 0) {
                const hasAnyReq = reqs.some(req => valueSet.has(req));
                if (!hasAnyReq) {
                  disabled = true;
                  isMissingReqs = true;
                  const reqLabels = reqs.map(reqKey => catalog.permissions.find(p => p.key === reqKey)?.label || reqKey);
                  hint = `Requer: ${reqLabels.join(' ou ')}`;
                }
              }

              const isExport = perm.key.endsWith('.export');
              const isViolated = hasViolation(perm.key);

              return (
                <div key={perm.key} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id={`perm-${perm.key}`}
                    checked={valueSet.has(perm.key)}
                    disabled={disabled}
                    onChange={() => togglePermission(perm.key)}
                    className="mt-1 w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    aria-describedby={isMissingReqs ? `hint-${perm.key}` : undefined}
                  />
                  <div className="flex flex-col flex-1">
                    <label 
                      htmlFor={`perm-${perm.key}`}
                      className={`text-sm font-medium ${disabled ? 'text-slate-400 cursor-not-allowed' : (isViolated ? 'text-rose-600 font-bold' : 'text-slate-700 cursor-pointer')}`}
                    >
                      {perm.label}
                    </label>
                    {isMissingReqs && (
                      <span id={`hint-${perm.key}`} className="text-xs text-rose-600 mt-0.5 font-medium">
                        {hint}
                      </span>
                    )}
                    {isExport && (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 mt-1.5 bg-amber-100/50 px-2 py-1 rounded w-fit border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        Concede base completa (LGPD)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
};
