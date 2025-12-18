import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { 
  Building2, 
  Users, 
  Calendar, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Plus,
  Trash2,
  FileText,
  UserCheck
} from 'lucide-react';
import api from '../services/api';

interface MeetingRoom {
  id: string;
  name: string;
  code: string;
  floor_number: number;
  building: string;
  capacity: number;
  equipment: Record<string, boolean>;
  description: string;
}

interface Employee {
  id: string;
  its_id: string;
  name: string;
  email: string;
  phone: string;
  department_name?: string;
}

interface Participant {
  its_id: string;
  name: string;
  email: string;
  phone: string;
  department_name?: string;
}

interface ConflictedParticipant {
  its_id: string;
  name: string;
  email: string;
  phone: string;
  conflicting_meetings: Array<{
    meeting_id: string;
    meeting_time: string;
    duration_minutes: number;
    purpose: string;
    location: string;
  }>;
}

const BookInternalMeetingPage = () => {
  const navigate = useNavigate();
  
  // User role detection
  const [isSecretary, setIsSecretary] = useState(false);
  
  // Secretary-specific: Employee selection
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // Step 1: Floor & Room Selection
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Step 2: Date & Time
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [duration, setDuration] = useState(60);
  
  // Step 3: Participants
  const [participants, setParticipants] = useState<Participant[]>([
    { its_id: '', name: '', email: '', phone: '' }
  ]);
  const [lookupLoading, setLookupLoading] = useState<number | null>(null);
  
  // Step 4: Purpose
  const [purpose, setPurpose] = useState('');
  
  // Conflict handling
  const [conflicts, setConflicts] = useState<ConflictedParticipant[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const floors = [0, 1, 2, 3, 4, 5];

  // Load user role and employees (for secretary)
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || '';
    setIsSecretary(role === 'secretary');
    
    if (role === 'secretary') {
      loadAssignedEmployees();
    }
  }, []);

  const loadAssignedEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response: any = await api.get('/secretaries/my-employees');
      setAssignedEmployees(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to load assigned employees:', err);
      setError('Failed to load assigned employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Load rooms when floor is selected
  useEffect(() => {
    if (selectedFloor !== null) {
      loadRooms(selectedFloor);
    }
  }, [selectedFloor]);

  const loadRooms = async (floor: number) => {
    setLoadingRooms(true);
    try {
      const response: any = await api.get(`/meeting-rooms?floor=${floor}`);
      setRooms(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError('Failed to load meeting rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const selectRoom = (room: MeetingRoom) => {
    setSelectedRoom(room);
    setError('');
  };

  const addParticipant = () => {
    setParticipants([...participants, { its_id: '', name: '', email: '', phone: '' }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleITSLookup = async (index: number, itsId: string) => {
    if (!itsId.trim()) return;

    setLookupLoading(index);
    setError('');
    
    try {
      const response: any = await api.get(`/users/lookup/${itsId.trim()}`);
      const user = response.data?.data || response.data;
      
      const updated = [...participants];
      updated[index] = {
        its_id: itsId.trim(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        department_name: user.department_name
      };
      setParticipants(updated);

      // Auto-check conflicts if we have date, time, and at least one participant
      if (meetingDate && meetingTime && updated.filter(p => p.name).length > 0) {
        await checkParticipantConflicts(updated);
      }
    } catch (err: any) {
      const updated = [...participants];
      updated[index] = { ...updated[index], name: '', email: '', phone: '' };
      setParticipants(updated);
      
      if (err.response?.status === 404) {
        setError(`ITS ID ${itsId} not found`);
      } else {
        setError('Failed to lookup user');
      }
    } finally {
      setLookupLoading(null);
    }
  };

  const checkParticipantConflicts = async (participantList: Participant[]) => {
    if (!meetingDate || !meetingTime) return;

    const validParticipants = participantList.filter(p => p.its_id.trim() && p.name);
    if (validParticipants.length === 0) return;

    try {
      const meetingDateTime = `${meetingDate}T${meetingTime}:00`;
      const response: any = await api.post('/internal-meetings/check-availability', {
        participant_its_ids: validParticipants.map(p => p.its_id),
        meeting_time: meetingDateTime,
        duration_minutes: duration
      });

      const conflicted = response.data?.data?.conflicted_participants || response.data?.conflicted_participants || [];
      
      if (conflicted.length > 0) {
        setConflicts(conflicted);
        setShowConflictDialog(true);
      } else {
        setConflicts([]);
        setShowConflictDialog(false);
      }
    } catch (err: any) {
      console.error('Failed to check conflicts:', err);
    }
  };

  const handleITSBlur = (index: number, itsId: string) => {
    handleITSLookup(index, itsId);
  };

  const handleITSKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, itsId: string) => {
    if (e.key === 'Tab' && !e.shiftKey && itsId.trim()) {
      e.preventDefault();
      handleITSLookup(index, itsId.trim());
    }
  };

  const checkConflicts = async () => {
    if (!meetingDate || !meetingTime) {
      setError('Please select date and time');
      return;
    }

    const validParticipants = participants.filter(p => p.its_id.trim() && p.name);
    if (validParticipants.length === 0) {
      setError('Please add at least one participant');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const meetingDateTime = `${meetingDate}T${meetingTime}:00`;
      const response: any = await api.post('/internal-meetings/check-availability', {
        participant_its_ids: validParticipants.map(p => p.its_id),
        meeting_time: meetingDateTime,
        duration_minutes: duration
      });

      const conflicted = response.data?.data?.conflicted_participants || response.data?.conflicted_participants || [];
      
      if (conflicted.length > 0) {
        setConflicts(conflicted);
        setShowConflictDialog(true);
      } else {
        // No conflicts, proceed to create meeting
        await createMeeting(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async (overrideConflicts: boolean) => {
    if (!selectedRoom || !meetingDate || !meetingTime) {
      setError('Please complete all required fields');
      return;
    }

    // Secretary validation
    if (isSecretary && !selectedEmployee) {
      setError('Please select an employee to book for');
      return;
    }

    const validParticipants = participants.filter(p => p.its_id.trim() && p.name);
    if (validParticipants.length === 0) {
      setError('Please add at least one participant');
      return;
    }

    if (validParticipants.length > selectedRoom.capacity) {
      setError(`Room capacity is ${selectedRoom.capacity}, but you have ${validParticipants.length} participants`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const meetingDateTime = `${meetingDate}T${meetingTime}:00`;
      const payload: any = {
        meeting_room_id: selectedRoom.id,
        meeting_time: meetingDateTime,
        duration_minutes: duration,
        purpose: purpose.trim() || 'Internal Meeting',
        participant_its_ids: validParticipants.map(p => p.its_id),
        override_conflicts: overrideConflicts,
        override_reason: overrideConflicts ? overrideReason : undefined
      };

      // Add primary_employee_its_id if secretary is booking
      if (isSecretary && selectedEmployee) {
        payload.primary_employee_its_id = selectedEmployee.its_id;
      }

      const response: any = await api.post('/internal-meetings', payload);

      const meetingId = response.data?.data?.meeting_id || response.data?.meeting_id;
      navigate(`/meetings/${meetingId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create meeting');
      setShowConflictDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) {
      setError('Please provide a reason for overriding');
      return;
    }
    await createMeeting(true);
  };

  const renderEquipment = (equipment: Record<string, boolean>) => {
    const items = Object.entries(equipment)
      .filter(([_, available]) => available)
      .map(([key]) => key.replace(/_/g, ' '));
    
    return items.length > 0 ? items.join(', ') : 'None';
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Book Internal Meeting Room</h1>
          <p className="text-gray-600 mt-2">Schedule meetings with internal staff members</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Secretary: Select Employee */}
        {isSecretary && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck size={24} className="text-primary-600" />
              Step 0: Select Employee to Book For
            </h2>
            
            {loadingEmployees ? (
              <div className="text-center py-4 text-gray-500">Loading assigned employees...</div>
            ) : assignedEmployees.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No employees assigned to you</div>
            ) : (
              <div>
                <select
                  value={selectedEmployee?.id || ''}
                  onChange={(e) => {
                    const emp = assignedEmployees.find(emp => emp.id === e.target.value);
                    setSelectedEmployee(emp || null);
                    setError('');
                  }}
                  className="input-field"
                >
                  <option value="">-- Select Employee --</option>
                  {assignedEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.its_id}) - {emp.email}
                    </option>
                  ))}
                </select>
                
                {selectedEmployee && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Booking for:</strong> {selectedEmployee.name}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {selectedEmployee.email} • {selectedEmployee.phone}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Select Floor */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={24} className="text-primary-600" />
            Step 1: Select Floor
          </h2>
          
          <div className="grid grid-cols-6 gap-3">
            {floors.map(floor => (
              <button
                key={floor}
                onClick={() => {
                  setSelectedFloor(floor);
                  setSelectedRoom(null);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedFloor === floor
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl font-bold">{floor === 0 ? 'G' : floor}</div>
                <div className="text-xs mt-1">{floor === 0 ? 'Ground' : `Floor ${floor}`}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select Room */}
        {selectedFloor !== null && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={24} className="text-primary-600" />
              Step 2: Select Room on Floor {selectedFloor === 0 ? 'G' : selectedFloor}
            </h2>

            {loadingRooms ? (
              <div className="text-center py-8 text-gray-500">Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No rooms available on this floor</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedRoom?.id === room.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{room.name}</div>
                        <div className="text-sm text-gray-600">{room.code}</div>
                      </div>
                      {selectedRoom?.id === room.id && (
                        <CheckCircle className="text-primary-600" size={20} />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-700 mt-2">
                      <span className="flex items-center gap-1">
                        <Users size={16} />
                        {room.capacity}
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="capitalize">{renderEquipment(room.equipment)}</span>
                    </div>
                    {room.description && (
                      <p className="text-xs text-gray-500 mt-2">{room.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Date & Time */}
        {selectedRoom && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={24} className="text-primary-600" />
              Step 3: Date & Time
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="input-field"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Add Participants */}
        {selectedRoom && meetingDate && meetingTime && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={24} className="text-primary-600" />
              Step 4: Add Participants (Max: {selectedRoom.capacity})
            </h2>

            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div key={index} className="grid md:grid-cols-5 gap-3 items-start">
                  <div>
                    <input
                      type="text"
                      placeholder="ITS ID (Press Tab)"
                      value={participant.its_id}
                      onChange={(e) => {
                        const updated = [...participants];
                        updated[index].its_id = e.target.value;
                        setParticipants(updated);
                      }}
                      onBlur={(e) => handleITSBlur(index, e.target.value)}
                      onKeyDown={(e) => handleITSKeyDown(e, index, participant.its_id)}
                      className="input-field"
                      disabled={lookupLoading === index}
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Name"
                      value={participant.name}
                      className="input-field bg-gray-50"
                      disabled
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={participant.email}
                      className="input-field bg-gray-50"
                      disabled
                    />
                  </div>

                  <div>
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={participant.phone}
                      className="input-field bg-gray-50"
                      disabled
                    />
                  </div>

                  <div className="flex gap-2">
                    {lookupLoading === index && (
                      <div className="text-sm text-gray-500 py-2">Loading...</div>
                    )}
                    {participants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="btn-secondary text-red-600 hover:bg-red-50"
                        title="Remove participant"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {participants.length < selectedRoom.capacity && (
                <button
                  type="button"
                  onClick={addParticipant}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Another Participant
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Purpose */}
        {selectedRoom && participants.some(p => p.name) && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={24} className="text-primary-600" />
              Step 5: Purpose (Optional)
            </h2>

            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Meeting purpose or agenda..."
              className="input-field min-h-[100px]"
            />
          </div>
        )}

        {/* Action Buttons */}
        {selectedRoom && participants.some(p => p.name) && (
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/meetings')}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={checkConflicts}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Book Meeting Room'}
            </button>
          </div>
        )}

        {/* Conflict Dialog */}
        {showConflictDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-orange-600" size={28} />
                    <h3 className="text-xl font-bold text-gray-900">Scheduling Conflicts Detected</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowConflictDialog(false);
                      setOverrideReason('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                      <div className="font-bold text-gray-900 mb-2">
                        {conflict.name} ({conflict.its_id})
                      </div>
                      <div className="text-sm text-gray-700 space-y-2">
                        {conflict.conflicting_meetings.map((meeting, mIndex) => (
                          <div key={mIndex} className="pl-4 border-l-2 border-orange-300">
                            <div className="font-medium">
                              {new Date(meeting.meeting_time).toLocaleString()}
                            </div>
                            <div className="text-gray-600">
                              {meeting.duration_minutes} min • {meeting.location}
                            </div>
                            {meeting.purpose && (
                              <div className="text-gray-600 italic">{meeting.purpose}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Override <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Why is this meeting more important? (All affected participants will be notified)"
                    className="input-field min-h-[80px]"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Overriding will cancel the conflicting meetings and notify all participants.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowConflictDialog(false);
                      setOverrideReason('');
                    }}
                    className="btn-secondary flex-1"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOverride}
                    className="btn-primary flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={loading || !overrideReason.trim()}
                  >
                    {loading ? 'Overriding...' : 'Override & Book'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BookInternalMeetingPage;
