import React from 'react';
import { Filter } from 'lucide-react';

interface FiltersProps {
  filters: any;
  setFilters: (f: any) => void;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-input)',
  borderColor: 'var(--border)',
  color: 'var(--text-2)',
};

export default function Filters({ filters, setFilters }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        className="border rounded px-3 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
        style={selectStyle}
      >
        <option value="">Status: Todos</option>
        <option value="open">Status: Aberto</option>
        <option value="resolved">Status: Resolvido</option>
      </select>

      <select
        value={filters.tipo}
        onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
        className="border rounded px-3 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
        style={selectStyle}
      >
        <option value="">Categoria: Todas</option>
        <option value="lead_incompleto">Lead Incompleto</option>
        <option value="erro_tecnico">Erro Técnico</option>
      </select>

      <button
        className="flex items-center gap-2 px-3 py-1 border rounded text-[10px] uppercase font-bold transition-all"
        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
      >
        <Filter size={12} />
        Filtros
      </button>
    </div>
  );
}
