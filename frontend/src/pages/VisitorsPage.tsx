import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { visitorApi } from '../services/api';
import type { Visitor } from '../types';

export const VisitorsPage: React.FC = () => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const res: any = await visitorApi.getAll();
      setVisitors(res.data.data || res.data);
    } catch (e) {
      console.error('Failed to load visitors', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((v: any) => {
      const name = v.name ?? '';
      const company = v.company ?? '';
      const its = v.its_id ?? v.itsId ?? '';
      return [name, company, its].some((x) => String(x).toLowerCase().includes(q));
    });
  }, [visitors, query]);

  const handleCheckout = async (id: string) => {
    try {
      await visitorApi.checkOut(id);
      await reload();
    } catch (e) {
      console.error('Checkout failed', e);
    }
  };

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Visitors</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor active and recent visitors.</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-gray-900 font-medium">
            <Users size={18} className="text-primary-700" />
            All Visitors
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field pl-9"
              placeholder="Search visitors..."
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No visitors found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Company</th>
                  <th className="py-3 pr-4 font-medium">Check-in</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v: any) => (
                  <tr key={v.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-medium text-gray-900">{v.name || '-'}</td>
                    <td className="py-3 pr-4 text-gray-700">{v.company || '-'}</td>
                    <td className="py-3 pr-4 text-gray-700">{v.check_in_time ? new Date(v.check_in_time).toLocaleString() : '-'}</td>
                    <td className="py-3 pr-4">
                      <span className={v.status === 'checked_in' ? 'badge badge-success' : 'badge badge-primary'}>
                        {v.status || '-'}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      {v.status === 'checked_in' ? (
                        <button
                          className="text-primary-700 hover:text-primary-800 font-medium"
                          onClick={() => handleCheckout(v.id)}
                        >
                          Check-out
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};
