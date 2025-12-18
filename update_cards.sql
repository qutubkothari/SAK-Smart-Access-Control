UPDATE users SET card_number = '40800909' WHERE its_id = 'ITS300001';
UPDATE users SET card_number = '60481321' WHERE its_id = 'ITS300002';
UPDATE users SET card_number = '30485514' WHERE its_id = 'ITS300003';
SELECT its_id, name, card_number FROM users WHERE card_number IS NOT NULL;
