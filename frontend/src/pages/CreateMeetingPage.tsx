import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { meetingApi, visitorApi, userApi } from '../services/api';
import { Plus, X, Search, User as UserIcon, MapPin, Building2 } from 'lucide-react';
import type { CreateMeetingDto, HostSearchResult } from '../types';

export const CreateMeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Select host
  const [hostQuery, setHostQuery] = useState('');
  const [hostResults, setHostResults] = useState<HostSearchResult[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostSearchResult | null>(null);
  const [hostSearching, setHostSearching] = useState(false);
  const hostSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meeting details
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [duration, setDuration] = useState(30);
  const [timeSlots, setTimeSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const minutesToHHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Step 2: Add visitors
  const [visitors, setVisitors] = useState([
    { itsId: '', name: '', email: '', phone: '', company: '', visitorType: 'guest' }
  ]);
  const [lookupLoadingIndex, setLookupLoadingIndex] = useState<number | null>(null);
  const [lookupErrorIndex, setLookupErrorIndex] = useState<number | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Search hosts with debounce
  const searchHosts = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setHostResults([]);
      return;
    }

    setHostSearching(true);
    try {
      const res: any = await userApi.searchHosts(q.trim());
      setHostResults(res?.data?.data || []);
    } catch (err) {
      console.error('Host search failed', err);
      setHostResults([]);
    } finally {
      setHostSearching(false);
    }
  }, []);

  useEffect(() => {
    if (hostSearchTimeout.current) clearTimeout(hostSearchTimeout.current);
    hostSearchTimeout.current = setTimeout(() => {
      searchHosts(hostQuery);
    }, 300);
    return () => {
      if (hostSearchTimeout.current) clearTimeout(hostSearchTimeout.current);
    };
  }, [hostQuery, searchHosts]);

  const selectHost = (host: HostSearchResult) => {
    setSelectedHost(host);
    setHostQuery('');
    setHostResults([]);
    setMeetingTime('');
    setMeetingDate('');
    setSelectedSlots([]);
    setTimeSlots([]);
  };

  const todayDate = new Date();
  const minDate = new Date(todayDate.getTime() - todayDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nowHHMM = new Date().toTimeString().slice(0, 5);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedHost || !meetingDate) {
        setTimeSlots([]);
        return;
      }

      setSlotsLoading(true);
      try {
        const res: any = await meetingApi.getAvailability({
          host_id: selectedHost.id,
          date: meetingDate,
          duration_minutes: 30,
          slot_minutes: 30,
        });
        const slots = res?.data?.data?.slots;
        setTimeSlots(Array.isArray(slots) ? slots : []);
      } catch (e) {
        console.error('Failed to load availability slots', e);
        setTimeSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [selectedHost?.id, meetingDate]);

  const pickSlot = (time: string, available: boolean) => {
    if (!available) return;
    if (meetingDate === minDate && time < nowHHMM) return;

    const slotMap = new Map(timeSlots.map((s) => [s.time, s.available] as const));
    const clickedMin = toMinutes(time);
    if (clickedMin === null) return;

    // Clicking an already-selected slot resets to that single slot (simple UX)
    if (selectedSlots.includes(time)) {
      setSelectedSlots([time]);
      setDuration(30);
      setMeetingTime(`${meetingDate}T${time}`);
      return;
    }

    if (selectedSlots.length === 0) {
      setSelectedSlots([time]);
      setDuration(30);
      setMeetingTime(`${meetingDate}T${time}`);
      return;
    }

    const mins = selectedSlots
      .map((t) => toMinutes(t))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    const minSel = mins[0];
    const maxSel = mins[mins.length - 1];

    const isBeforeEdge = clickedMin === minSel - 30;
    const isAfterEdge = clickedMin === maxSel + 30;

    if (!isBeforeEdge && !isAfterEdge) {
      // Non-adjacent selection resets (keeps selection contiguous)
      setSelectedSlots([time]);
      setDuration(30);
      setMeetingTime(`${meetingDate}T${time}`);
      return;
    }

    const newMin = isBeforeEdge ? clickedMin : minSel;
    const newMax = isAfterEdge ? clickedMin : maxSel;

    // Ensure every 30-min slot in the range is available
    const range: string[] = [];
    for (let m = newMin; m <= newMax; m += 30) {
      const hhmm = minutesToHHMM(m);
      if (!slotMap.get(hhmm)) {
        return;
      }
      range.push(hhmm);
    }

    range.sort();
    setSelectedSlots(range);
    setDuration(range.length * 30);
    setMeetingTime(`${meetingDate}T${range[0]}`);
  };

  const addVisitor = () => {
    setVisitors([...visitors, { itsId: '', name: '', email: '', phone: '', company: '', visitorType: 'guest' }]);
  };

  const removeVisitor = (index: number) => {
    setVisitors(visitors.filter((_, i) => i !== index));
  };

  const updateVisitor = (index: number, field: string, value: string) => {
    const updated = [...visitors];
    updated[index] = { ...updated[index], [field]: value };
    setVisitors(updated);
  };

  const lookupVisitorDetails = async (index: number) => {
    setLookupError('');
    setLookupErrorIndex(null);
    setLookupLoadingIndex(index);

    try {
      const visitor = visitors[index];
      const itsId = visitor.itsId?.trim();
      const phone = visitor.phone?.trim();

      if (!itsId && !phone) {
        setLookupErrorIndex(index);
        setLookupError('Enter ITS ID (preferred) or Mobile number.');
        return;
      }

      let res: any;

      if (itsId) {
        res = await visitorApi.lookup({ its_id: itsId });
      } else {
        res = await visitorApi.lookup({ phone });
      }

      const payload = res?.data;
      const v = payload?.data?.visitor;

      if (!payload?.success || !v) {
        setLookupErrorIndex(index);
        setLookupError('Visitor details not found.');
        return;
      }

      const updated = [...visitors];
      updated[index] = {
        ...updated[index],
        itsId: updated[index].itsId || v.its_id || '',
        name: v.name ?? updated[index].name,
        email: v.email ?? updated[index].email,
        phone: v.phone ?? updated[index].phone,
        company: v.company ?? updated[index].company,
      };
      setVisitors(updated);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        const visitor = visitors[index];
        const phone = visitor.phone?.trim();
        const itsId = visitor.itsId?.trim();

        if (itsId && phone) {
          try {
            const res: any = await visitorApi.lookup({ phone });
            const payload = res?.data;
            const v = payload?.data?.visitor;
            if (payload?.success && v) {
              const updated = [...visitors];
              updated[index] = {
                ...updated[index],
                name: v.name ?? updated[index].name,
                email: v.email ?? updated[index].email,
                phone: v.phone ?? updated[index].phone,
                company: v.company ?? updated[index].company,
              };
              setVisitors(updated);
              return;
            }
          } catch {
            // fall through
          }
        }

        setLookupErrorIndex(index);
        setLookupError('Visitor details not found.');
        return;
      }

      setLookupErrorIndex(index);
      setLookupError('Failed to fetch visitor details.');
    } finally {
      setLookupLoadingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedHost) {
      setError('Please select whom to meet.');
      return;
    }

    if (!meetingTime) {
      setError('Please select meeting date and time.');
      return;
    }

    const validVisitors = visitors.filter(v => v.name && v.email && v.phone);
    if (validVisitors.length === 0) {
      setError('Please add at least one visitor with complete details.');
      return;
    }

    setLoading(true);

    try {
      const location = [
        selectedHost.building,
        selectedHost.floor_number ? `Floor ${selectedHost.floor_number}` : null,
        selectedHost.department_name
      ].filter(Boolean).join(', ') || 'Office';

      const data: CreateMeetingDto = {
        host_id: selectedHost.id,
        meeting_time: meetingTime,
        duration_minutes: duration,
        location,
        room_number: undefined,
        purpose: undefined,
        visitors: validVisitors.map(({ itsId, name, email, phone, company, visitorType }) => ({
          its_id: itsId?.trim() || undefined,
          name,
          email,
          phone,
          company: company || undefined,
          visitor_type: visitorType,
        })),
      };

      const response: any = await meetingApi.create(data);
      const meetingId = response?.data?.data?.meeting_id;
      if (meetingId) {
        navigate(`/meetings/${meetingId}`);
      } else {
        navigate('/meetings');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Meeting</h1>
          <p className="text-gray-600 mt-1">Select host and add visitors — that's it!</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Host */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserIcon size={20} className="text-primary-700" />
              Step 1: Whom to Meet?
            </h2>

            {!selectedHost ? (
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={hostQuery}
                  onChange={(e) => setHostQuery(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Search by name, ITS ID, or email..."
                  autoFocus
                />

                {hostSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    Searching...
                  </div>
                )}

                {hostResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {hostResults.map((host) => (
                      <button
                        key={host.id}
                        type="button"
                        onClick={() => selectHost(host)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition"
                      >
                        <div className="font-medium text-gray-900">{host.name}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-3 mt-1">
                          <span>ITS: {host.its_id}</span>
                          {host.department_name && (
                            <>
                              <span>•</span>
                              <span>{host.department_name}</span>
                            </>
                          )}
                        </div>
                        {(host.building || host.floor_number) && (
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin size={14} />
                            {[host.building, host.floor_number ? `Floor ${host.floor_number}` : null]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {hostQuery.trim().length >= 2 && !hostSearching && hostResults.length === 0 && (
                  <div className="mt-2 text-sm text-gray-500">No hosts found.</div>
                )}
              </div>
            ) : (
              <div className="border border-primary-200 bg-primary-50 rounded-lg p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <UserIcon size={18} className="text-primary-700" />
                    <div className="font-bold text-gray-900">{selectedHost.name}</div>
                  </div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div>ITS ID: {selectedHost.its_id}</div>
                    {selectedHost.email && <div>Email: {selectedHost.email}</div>}
                    {selectedHost.department_name && (
                      <div className="flex items-center gap-1">
                        <Building2 size={14} />
                        {selectedHost.department_name}
                      </div>
                    )}
                    {(selectedHost.building || selectedHost.floor_number) && (
                      <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        {[selectedHost.building, selectedHost.floor_number ? `Floor ${selectedHost.floor_number}` : null]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHost(null)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Change host"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Step 1.5: Meeting Details */}
          {selectedHost && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Meeting Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => {
                      setMeetingDate(e.target.value);
                      setSelectedSlots([]);
                      setMeetingTime('');
                      setDuration(30);
                    }}
                    className="input-field"
                    required
                    min={minDate}
                  />
                </div>
              </div>

              {/* Time slots (30-min intervals) */}
              {meetingDate && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Select Time Slots (30-min) *</label>
                    {slotsLoading && <span className="text-sm text-gray-500">Loading...</span>}
                  </div>

                  {timeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {timeSlots.map((s) => {
                        const isPast = meetingDate === minDate && s.time < nowHHMM;
                        const disabled = !s.available || isPast;
                        const selected = selectedSlots.includes(s.time);
                        return (
                          <button
                            key={s.time}
                            type="button"
                            onClick={() => pickSlot(s.time, s.available)}
                            disabled={disabled}
                            className={
                              `px-2 py-2 rounded border text-sm transition ` +
                              (selected
                                ? 'bg-primary-600 text-white border-primary-600'
                                : disabled
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50')
                            }
                            title={
                              isPast
                                ? 'Past time'
                                : (!s.available ? 'Already booked' : 'Available')
                            }
                          >
                            {s.time}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Select a date to see available slots.</div>
                  )}

                  {selectedSlots.length > 0 && (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-700">
                        Selected: <span className="font-medium">{selectedSlots[0]}</span> - <span className="font-medium">{minutesToHHMM((toMinutes(selectedSlots[selectedSlots.length - 1]) || 0) + 30)}</span>
                        <span className="text-gray-500"> ({duration} mins)</span>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => {
                          setSelectedSlots([]);
                          setMeetingTime('');
                          setDuration(30);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Hidden value so existing submit validation stays the same */}
                  <input type="hidden" value={meetingTime} readOnly />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Add Visitors */}
          {selectedHost && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Step 2: Add Visitors ({visitors.length})
                </h2>
                <button
                  type="button"
                  onClick={addVisitor}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Add Visitor
                </button>
              </div>

              <div className="space-y-4">
                {visitors.map((visitor, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg relative">
                    {visitors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVisitor(index)}
                        className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={16} />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ITS ID (preferred)
                        </label>
                        <input
                          type="text"
                          value={visitor.itsId}
                          onChange={(e) => updateVisitor(index, 'itsId', e.target.value)}
                          className="input-field"
                          placeholder="e.g., 12345678"
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mobile
                          </label>
                          <input
                            type="tel"
                            value={visitor.phone}
                            onChange={(e) => updateVisitor(index, 'phone', e.target.value)}
                            className="input-field"
                            placeholder="+1234567890"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => lookupVisitorDetails(index)}
                          disabled={lookupLoadingIndex === index}
                          className="btn-secondary h-[42px] px-4 disabled:opacity-50"
                          title="Fetch visitor details"
                        >
                          {lookupLoadingIndex === index ? 'Fetching…' : 'Fetch'}
                        </button>
                      </div>

                      {lookupErrorIndex === index && lookupError ? (
                        <div className="md:col-span-2 text-sm text-red-600">
                          {lookupError}
                        </div>
                      ) : null}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={visitor.name}
                          onChange={(e) => updateVisitor(index, 'name', e.target.value)}
                          className="input-field"
                          placeholder="Visitor's full name"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={visitor.email}
                          onChange={(e) => updateVisitor(index, 'email', e.target.value)}
                          className="input-field"
                          placeholder="email@example.com"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company
                        </label>
                        <input
                          type="text"
                          value={visitor.company}
                          onChange={(e) => updateVisitor(index, 'company', e.target.value)}
                          className="input-field"
                          placeholder="Company name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Visitor Type
                        </label>
                        <select
                          value={visitor.visitorType}
                          onChange={(e) => updateVisitor(index, 'visitorType', e.target.value)}
                          className="input-field"
                        >
                          <option value="guest">Guest</option>
                          <option value="vendor">Vendor</option>
                          <option value="contractor">Contractor</option>
                          <option value="vip">VIP</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedHost && (
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Meeting & Send Invites'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="btn-secondary px-6 py-3"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};
