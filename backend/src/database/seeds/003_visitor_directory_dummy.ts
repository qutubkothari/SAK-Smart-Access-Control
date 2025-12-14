import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const now = new Date();

  await knex('visitor_directory')
    .insert([
      {
        its_id: '30484186',
        name: 'Qutbuddin Kothari',
        phone: '+919537653927',
        email: 'kothariqutub@gmail.com',
        created_at: now,
        updated_at: now
      },
      {
        its_id: '30485514',
        name: 'Jumana Kothari',
        phone: '+917984573527',
        email: 'jummanaq@gmail.com',
        created_at: now,
        updated_at: now
      },
      {
        its_id: '60481321',
        name: 'Mustafa Kothari',
        phone: '+918484862949',
        email: 'mustafaqk53@gmail.com',
        created_at: now,
        updated_at: now
      }
    ])
    .onConflict('its_id')
    .merge();
}
