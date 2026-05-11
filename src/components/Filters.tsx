import React from 'react';
import { Filter, Search } from 'lucide-react';

interface FiltersProps {
  filters: any;
  setFilters: (f: any) => void;
}

export default function Filters({ filters, setFilters }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select 
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-[10px] font-bold uppercase text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
      >
        <option value="">Status: Todos</option>
        <option value="open">Status: Aberto</option>
        <option value="resolved">Status: Resolvido</option>
      </select>

      <select 
        value={filters.tipo}
        onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
        className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-[10px] font-bold uppercase text-slate-300 outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
      >
        <option value="">Categoria: Todas</option>
        <option value="lead_incompleto">Categorias: Lead</option>
        <option value="erro_tecnico">Categorias: Erro</option>
      </select>

      <button className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] uppercase font-bold transition-all">
        <Filter size={12} />
        Filtros
      </button>
    </div>
  );
}
