#!/bin/bash
sudo -u postgres createdb sak_access_control
sudo -u postgres psql -c "CREATE USER sakuser WITH PASSWORD 'SAK2025SecurePass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sakuser;"
sudo -u postgres psql -d sak_access_control -c "GRANT ALL ON SCHEMA public TO sakuser;"
echo "Database setup complete!"
