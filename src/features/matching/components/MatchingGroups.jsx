import React from 'react';

// Subcomponente que usa tu página de resultados
export function MatchingSummary() {
  return (
    <div className="p-4 rounded-xl border border-dashed border-[#E6EAE3] text-center text-xs">
      <p className="font-semibold">Resumen del Emparejamiento</p>
    </div>
  );
}

// Componente principal que usa tu MatchingPage
export default function MatchingGroups({ groups }) {
  return (
    <div className="mt-4 p-4 rounded-2xl bg-[#F8FAF6] border border-[#E6EAE3]">
      <h3 className="text-sm font-bold mb-2">Grupos Generados ({groups?.length || 0})</h3>
      <div className="space-y-2">
        {groups?.map((group, index) => (
          <div key={index} className="p-3 bg-white rounded-xl border border-[#E6EAE3] text-xs">
            <span className="font-bold text-[#2A7A35]">Grupo {index + 1}:</span> {JSON.stringify(group.studentIds)}
          </div>
        ))}
      </div>
    </div>
  );
}