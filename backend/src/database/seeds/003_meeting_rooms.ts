import { Knex } from 'knex';

/**
 * Seed meeting rooms for each floor
 */
export async function seed(knex: Knex): Promise<void> {
  // Check if rooms already exist
  const existing = await knex('meeting_rooms').select('id').first();
  if (existing) {
    console.log('Meeting rooms already exist, skipping seed');
    return;
  }

  const rooms = [
    // Ground Floor
    { name: 'Reception Conference Room', code: 'CR-G1', floor_number: 0, building: 'Main Tower', capacity: 6, equipment: { tv: true, whiteboard: true }, description: 'Small conference room near reception' },
    
    // Floor 1
    { name: 'Board Room A', code: 'BR-1A', floor_number: 1, building: 'Main Tower', capacity: 20, equipment: { projector: true, tv: true, whiteboard: true, video_conference: true }, description: 'Large boardroom for executive meetings' },
    { name: 'Meeting Room 1B', code: 'MR-1B', floor_number: 1, building: 'Main Tower', capacity: 8, equipment: { tv: true, whiteboard: true }, description: 'Medium meeting room' },
    
    // Floor 2
    { name: 'Conference Room 2A', code: 'CR-2A', floor_number: 2, building: 'Main Tower', capacity: 12, equipment: { projector: true, whiteboard: true, video_conference: true }, description: 'Conference room with AV setup' },
    { name: 'Meeting Room 2B', code: 'MR-2B', floor_number: 2, building: 'Main Tower', capacity: 6, equipment: { tv: true, whiteboard: true }, description: 'Small meeting space' },
    { name: 'Meeting Room 2C', code: 'MR-2C', floor_number: 2, building: 'Main Tower', capacity: 4, equipment: { whiteboard: true }, description: 'Huddle room' },
    
    // Floor 3
    { name: 'Tech Hub 3A', code: 'TH-3A', floor_number: 3, building: 'Tech Tower', capacity: 15, equipment: { projector: true, whiteboard: true, dual_monitors: true }, description: 'Tech team collaboration space' },
    { name: 'Meeting Room 3B', code: 'MR-3B', floor_number: 3, building: 'Tech Tower', capacity: 8, equipment: { tv: true, whiteboard: true }, description: 'Standard meeting room' },
    { name: 'Focus Room 3C', code: 'FR-3C', floor_number: 3, building: 'Tech Tower', capacity: 4, equipment: { whiteboard: true }, description: 'Small focus room' },
    
    // Floor 4
    { name: 'Training Room 4A', code: 'TR-4A', floor_number: 4, building: 'Main Tower', capacity: 30, equipment: { projector: true, whiteboard: true, sound_system: true }, description: 'Large training facility' },
    { name: 'Meeting Room 4B', code: 'MR-4B', floor_number: 4, building: 'Main Tower', capacity: 10, equipment: { tv: true, whiteboard: true }, description: 'Medium meeting room' },
    
    // Floor 5
    { name: 'Executive Suite', code: 'ES-5A', floor_number: 5, building: 'Main Tower', capacity: 12, equipment: { projector: true, tv: true, whiteboard: true, video_conference: true, sound_system: true }, description: 'Premium executive meeting space' },
    { name: 'Sky Lounge Meeting', code: 'SL-5B', floor_number: 5, building: 'Main Tower', capacity: 8, equipment: { tv: true, whiteboard: true }, description: 'Meeting room with city view' },
  ];

  await knex('meeting_rooms').insert(rooms);

  console.log(`✅ Seeded ${rooms.length} meeting rooms`);
}
