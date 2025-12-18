import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { meetingApi, visitorApi, userApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { INDIA_CITY_SUGGESTIONS, INDIA_STATES_AND_UTS } from '../data/indiaGeo';
import { Plus, X, Search, User as UserIcon, MapPin, Building2, Nfc } from 'lucide-react';
import type { CreateMeetingDto, HostSearchResult } from '../types';

export const CreateMeetingPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Select host
  const [hostQuery, setHostQuery] = useState('');
  const [hostResults, setHostResults] = useState<HostSearchResult[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostSearchResult | null>(null);
  const [hostSearching, setHostSearching] = useState(false);
  const hostSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-select employee as host if role is employee
  useEffect(() => {
    if (user?.role === 'employee' && user?.id && !selectedHost) {
      // Handle both camelCase and snake_case from backend
      const userItsId = (user as any).its_id || user.itsId || '';
      setSelectedHost({
        id: user.id,
        its_id: userItsId,
        name: user.name,
        email: user.email || '',
        department_name: '',
        building: '',
        floor_number: undefined
      });
    }
  }, [user, selectedHost]);

  // Check NFC support on mount
  useEffect(() => {
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

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
    { itsId: '', name: '', email: '', phone: '', company: '', city: '', state: '', visitorType: 'guest' }
  ]);
  const [meetingType, setMeetingType] = useState<'external' | 'internal'>('external');
  const [lookupLoadingIndex, setLookupLoadingIndex] = useState<number | null>(null);
  const [lookupErrorIndex, setLookupErrorIndex] = useState<number | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [employeeSearchResults, setEmployeeSearchResults] = useState<HostSearchResult[]>([]);
  const [searchingEmployeeIndex, setSearchingEmployeeIndex] = useState<number | null>(null);
  const employeeSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);

  // Multi-day and QR options
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [visitStartDate, setVisitStartDate] = useState('');
  const [visitEndDate, setVisitEndDate] = useState('');
  const [generateIndividualQR, setGenerateIndividualQR] = useState(true);
  const [meetingMessageTemplate, setMeetingMessageTemplate] = useState('');

  // Search hosts with debounce
  const searchHosts = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setHostResults([]);
      return;
    }

    setHostSearching(true);
    try {
      const res: any = await userApi.searchHosts(q.trim());
      setHostResults(res?.data?.data || res?.data || []);
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

  // Search employees for internal meetings
  const searchEmployees = useCallback(async (query: string, index: number) => {
    if (query.trim().length < 2) {
      setEmployeeSearchResults([]);
      return;
    }

    setSearchingEmployeeIndex(index);
    try {
      const res: any = await userApi.searchHosts(query.trim());
      // Filter to only employees (ITS ID starting with ITS3)
      const employees = (res?.data?.data || res?.data || []).filter((u: HostSearchResult) => 
        u.its_id?.startsWith('ITS3')
      );
      setEmployeeSearchResults(employees);
      
      // Auto-select if exact ITS ID match (for RFID scanner)
      if (employees.length === 1 && employees[0].its_id?.toUpperCase() === query.trim().toUpperCase()) {
        selectEmployee(employees[0], index);
      }
    } catch (err) {
      console.error('Employee search failed', err);
      setEmployeeSearchResults([]);
    } finally {
      setSearchingEmployeeIndex(null);
    }
  }, []);

  const selectEmployee = (employee: HostSearchResult, index: number) => {
    const updated = [...visitors];
    updated[index] = {
      ...updated[index],
      itsId: employee.its_id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
    };
    setVisitors(updated);
    setEmployeeSearchResults([]);
  };

  // NFC Scan function
  const handleNFCScan = async (index: number) => {
    if (!('NDEFReader' in window)) {
      alert('NFC is not supported on this device/browser. Please use Chrome on Android.');
      return;
    }

    try {
      setNfcScanning(true);
      const ndef = new (window as any).NDEFReader();
      
      await ndef.scan();
      
      ndef.addEventListener('reading', ({ message, serialNumber }: any) => {
        setNfcScanning(false);
        
        console.log('NFC Tag Scanned:', { message, serialNumber });
        
        // Try to read data from NFC tag
        let scannedValue = '';
        
        for (const record of message.records) {
          try {
            // Try reading as text
            if (record.recordType === 'text') {
              const textDecoder = new TextDecoder(record.encoding || 'utf-8');
              const text = textDecoder.decode(record.data);
              
              // Extract any ITS ID or number from text
              const itsMatch = text.match(/ITS\d+/i);
              if (itsMatch) {
                scannedValue = itsMatch[0].toUpperCase();
                break;
              }
              
              // Extract just numbers
              const numMatch = text.match(/\d+/);
              if (numMatch) {
                scannedValue = numMatch[0];
                break;
              }
            }
            
            // Try reading raw data as text
            if (!scannedValue && record.data) {
              const rawDecoder = new TextDecoder('utf-8');
              const rawText = rawDecoder.decode(record.data);
              
              // Extract ITS ID or numbers
              const itsMatch = rawText.match(/ITS\d+/i);
              if (itsMatch) {
                scannedValue = itsMatch[0].toUpperCase();
                break;
              }
              
              const numMatch = rawText.match(/\d+/);
              if (numMatch) {
                scannedValue = numMatch[0];
                break;
              }
            }
          } catch (decodeError) {
            console.error('NFC decode error:', decodeError);
          }
        }
        
        // Try serial number as fallback
        if (!scannedValue && serialNumber) {
          const numericSerial = serialNumber.replace(/[^0-9]/g, '');
          if (numericSerial) {
            scannedValue = numericSerial;
          }
        }
        
        if (scannedValue) {
          // Convert NFC card number to possible ITS ID variations
          const possibleIds = [scannedValue]; // Original scanned value
          
          // Try different conversions for 10-digit NFC numbers
          if (/^\d{10}$/.test(scannedValue)) {
            // Try last 8 digits
            possibleIds.push(scannedValue.slice(-8));
            // Try removing first 2 digits
            possibleIds.push(scannedValue.slice(2));
            // Try converting from hex to decimal (if it's hex encoded)
            try {
              const hexValue = parseInt(scannedValue, 16);
              possibleIds.push(hexValue.toString());
            } catch (e) {
              // Not hex
            }
          }
          
          // Show a dialog with the scanned value
          const searchValue = scannedValue;
          updateVisitor(index, 'itsId', searchValue);
          
          // Try searching with all possible conversions
          const trySearches = async () => {
            for (const id of possibleIds) {
              try {
                const res: any = await userApi.searchHosts(id);
                const employees = (res?.data?.data || []).filter((u: HostSearchResult) => 
                  u.its_id?.startsWith('ITS3')
                );
                if (employees.length > 0) {
                  // Found a match!
                  setEmployeeSearchResults(employees);
                  if (employees.length === 1) {
                    selectEmployee(employees[0], index);
                  }
                  return; // Stop searching
                }
              } catch (e) {
                // Continue to next possibility
              }
            }
            // No matches found with any conversion
            alert(`Card scanned: ${scannedValue}\n\nNo employee found with this card number or its conversions.\n\nPlease manually enter the ITS ID.`);
          };
          
          trySearches();
        } else {
          alert('Could not read data from NFC tag. Please enter ITS ID manually.');
        }
      });

      ndef.addEventListener('readingerror', () => {
        setNfcScanning(false);
        alert('Error reading NFC tag. The card may be encrypted. Please enter ITS ID manually.');
      });

    } catch (error: any) {
      setNfcScanning(false);
      if (error.name === 'NotAllowedError') {
        alert('NFC permission denied. Please allow NFC access in your browser settings.');
      } else {
        alert(`NFC scan failed: ${error.message}`);
      }
    }
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
        const slots = res?.data?.data?.slots || res?.data?.slots;
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
    setVisitors([...visitors, { itsId: '', name: '', email: '', phone: '', company: '', city: '', state: '', visitorType: 'guest' }]);
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
        city: v.city ?? updated[index].city,
        state: v.state ?? updated[index].state,
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
                city: v.city ?? updated[index].city,
                state: v.state ?? updated[index].state,
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

    // Validate multi-day dates
    if (isMultiDay && (!visitStartDate || !visitEndDate)) {
      setError('Please select both start and end dates for multi-day access.');
      return;
    }

    if (isMultiDay && visitStartDate && visitEndDate && new Date(visitStartDate) > new Date(visitEndDate)) {
      setError('End date must be after start date for multi-day access.');
      return;
    }

    // Validation differs for external vs internal meetings
    const validVisitors = meetingType === 'external' 
      ? visitors.filter(v => v.name && v.email && v.phone)
      : visitors.filter(v => v.name && v.email);
      
    if (validVisitors.length === 0) {
      const errorMsg = meetingType === 'external' 
        ? 'Please add at least one visitor with complete details (name, email, phone).'
        : 'Please add at least one employee participant with complete details (name, email).';
      setError(errorMsg);
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
        visitors: validVisitors.map(({ itsId, name, email, phone, company, city, state, visitorType }) => ({
          its_id: itsId?.trim() || undefined,
          name,
          email,
          phone: phone || undefined,
          company: company || undefined,
          city: city || undefined,
          state: state || undefined,
          visitor_type: visitorType,
        })),
        is_multi_day: isMultiDay,
        visit_start_date: isMultiDay ? visitStartDate : undefined,
        visit_end_date: isMultiDay ? visitEndDate : undefined,
        generate_individual_qr: generateIndividualQR,
        meeting_message_template: !generateIndividualQR ? meetingMessageTemplate : undefined,
      };

      const response: any = await meetingApi.create(data);
      const meetingId = response?.data?.data?.meeting_id || response?.data?.meeting_id;
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
      <datalist id="city-suggestions">
        {INDIA_CITY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="state-suggestions">
        {INDIA_STATES_AND_UTS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
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

            {user?.role === 'employee' && selectedHost ? (
              // Employee sees their own info as host (read-only)
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-primary-700 mb-1">Host (You)</div>
                    <div className="font-semibold text-gray-900 text-lg">{selectedHost.name}</div>
                    <div className="text-sm text-gray-600 mt-1">ITS: {selectedHost.its_id}</div>
                    {selectedHost.department_name && (
                      <div className="text-sm text-gray-600 mt-1">{selectedHost.department_name}</div>
                    )}
                    {(selectedHost.building || selectedHost.floor_number) && (
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={14} />
                        {[selectedHost.building, selectedHost.floor_number ? `Floor ${selectedHost.floor_number}` : null]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : !selectedHost ? (
              // Other roles see search dropdown
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
            ) : user?.role !== 'employee' ? (
              // Non-employee roles see selected host with option to change
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
            ) : null}
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
                  Step 2: Add {meetingType === 'external' ? 'Visitors' : 'Participants'} ({visitors.length})
                </h2>
                <button
                  type="button"
                  onClick={addVisitor}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Add {meetingType === 'external' ? 'Visitor' : 'Participant'}
                </button>
              </div>

              {/* Meeting Type Toggle */}
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMeetingType('external')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    meetingType === 'external'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  External Visitor
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingType('internal')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    meetingType === 'internal'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Internal Employee
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

                    {meetingType === 'external' ? (
                      // External Visitor Form
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
                            City
                          </label>
                          <input
                            type="text"
                            list="city-suggestions"
                            value={visitor.city || ''}
                            onChange={(e) => updateVisitor(index, 'city', e.target.value)}
                            className="input-field"
                            placeholder="e.g., Mumbai"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            list="state-suggestions"
                            value={visitor.state || ''}
                            onChange={(e) => updateVisitor(index, 'state', e.target.value)}
                            className="input-field"
                            placeholder="e.g., Maharashtra"
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
                    ) : (
                      // Internal Employee Form
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search Employee (ITS ID or Name) *
                            <span className="text-xs text-gray-500 ml-2">
                              ({nfcSupported ? 'NFC Ready' : 'RFID Scanner Ready'})
                            </span>
                          </label>
                          <div className="relative flex gap-2">
                            <div className="relative flex-1">
                              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                value={visitor.itsId}
                                onChange={(e) => {
                                  updateVisitor(index, 'itsId', e.target.value);
                                  // Debounce employee search
                                  if (employeeSearchTimeout.current) clearTimeout(employeeSearchTimeout.current);
                                  employeeSearchTimeout.current = setTimeout(() => {
                                    searchEmployees(e.target.value, index);
                                  }, 300);
                                }}
                                onKeyDown={(e) => {
                                  // RFID scanners typically send Enter after scanning
                                  if (e.key === 'Enter' && employeeSearchResults.length === 1) {
                                    e.preventDefault();
                                    selectEmployee(employeeSearchResults[0], index);
                                  }
                                }}
                                className="input-field pl-10"
                                placeholder="Scan RFID card or type ITS ID (e.g., ITS300001)"
                                autoFocus={index === 0 && !visitor.name}
                              />
                            </div>
                            
                            {/* NFC Scan Button - Only show if NFC supported */}
                            {nfcSupported && !visitor.name && (
                              <button
                                type="button"
                                onClick={() => handleNFCScan(index)}
                                disabled={nfcScanning}
                                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 whitespace-nowrap ${
                                  nfcScanning
                                    ? 'bg-blue-100 text-blue-600 cursor-wait'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                                title="Tap to scan NFC card"
                              >
                                <Nfc size={20} className={nfcScanning ? 'animate-pulse' : ''} />
                                {nfcScanning ? 'Scanning...' : 'Scan NFC'}
                              </button>
                            )}
                            
                            {searchingEmployeeIndex === index && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                Searching...
                              </div>
                            )}
                          </div>

                          {/* Employee Search Results Dropdown */}
                          {employeeSearchResults.length > 0 && !visitor.name && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {employeeSearchResults.map((emp) => (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => selectEmployee(emp, index)}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition"
                                >
                                  <div className="font-medium text-gray-900">{emp.name}</div>
                                  <div className="text-sm text-gray-600 flex items-center gap-3 mt-1">
                                    <span>ITS: {emp.its_id}</span>
                                    {emp.email && (
                                      <>
                                        <span>•</span>
                                        <span>{emp.email}</span>
                                      </>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {visitor.name && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Employee Name
                              </label>
                              <input
                                type="text"
                                value={visitor.name}
                                className="input-field bg-gray-50"
                                readOnly
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                value={visitor.email}
                                className="input-field bg-gray-50"
                                readOnly
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mobile *
                              </label>
                              <input
                                type="tel"
                                value={visitor.phone}
                                onChange={(e) => updateVisitor(index, 'phone', e.target.value)}
                                className="input-field"
                                placeholder="+1234567890"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...visitors];
                                  updated[index] = {
                                    itsId: '',
                                    name: '',
                                    email: '',
                                    phone: '',
                                    company: '',
                                    city: '',
                                    state: '',
                                    visitorType: 'guest'
                                  };
                                  setVisitors(updated);
                                  setEmployeeSearchResults([]);
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700"
                              >
                                ← Search Different Employee
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Multi-Day and QR Options (External visitors only) */}
          {meetingType === 'external' && selectedHost && visitors.some(v => v.name && v.email && v.phone) && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-primary-600" />
                Step 3: Visit Options
              </h2>

              {/* Multi-Day Access */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMultiDay}
                    onChange={(e) => {
                      setIsMultiDay(e.target.checked);
                      if (!e.target.checked) {
                        setVisitStartDate('');
                        setVisitEndDate('');
                      }
                    }}
                    className="mt-1 h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Multi-Day Access</span>
                    <p className="text-sm text-gray-600 mt-1">
                      Enable this for visitors who need multiple days entry with flexible timing (e.g., contractors, consultants, delegates)
                    </p>
                  </div>
                </label>

                {isMultiDay && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Valid From
                      </label>
                      <input
                        type="date"
                        value={visitStartDate}
                        onChange={(e) => setVisitStartDate(e.target.value)}
                        min={minDate}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Valid Until
                      </label>
                      <input
                        type="date"
                        value={visitEndDate}
                        onChange={(e) => setVisitEndDate(e.target.value)}
                        min={visitStartDate || minDate}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* QR Code Generation Option */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateIndividualQR}
                    onChange={(e) => {
                      setGenerateIndividualQR(e.target.checked);
                      if (e.target.checked) {
                        setMeetingMessageTemplate('');
                      }
                    }}
                    className="mt-1 h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900">Generate Individual QR Codes</span>
                    <p className="text-sm text-gray-600 mt-1">
                      {visitors.length > 1 
                        ? `Send separate QR codes to each of the ${visitors.length} visitors. Uncheck this for large delegations who may not scan individual QR codes.`
                        : 'Send QR code to the visitor. Uncheck this for delegations who may not scan QR codes.'}
                    </p>
                  </div>
                </label>

                {!generateIndividualQR && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Meeting Message (Optional)
                    </label>
                    <textarea
                      value={meetingMessageTemplate}
                      onChange={(e) => setMeetingMessageTemplate(e.target.value)}
                      className="input-field h-24"
                      placeholder="Enter a custom message to send to visitors instead of QR codes. Leave empty for default message."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Visitors will receive meeting details and instructions to check in at reception without a QR code.
                    </p>
                  </div>
                )}
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
