#!/bin/bash
# Deployment script for departments API fix

echo ' Deploying departments API endpoint...'

# Backup existing files
echo ' Creating backup...'
sudo cp /var/www/sak-backend/dist/server.js /var/www/sak-backend/dist/server.js.backup

# Create directories if they don't exist
echo ' Creating directories...'
sudo mkdir -p /var/www/sak-backend/dist/controllers
sudo mkdir -p /var/www/sak-backend/dist/routes

# Copy new files
echo ' Copying files...'
sudo cp ~/backend-fix/dist/controllers/department.controller.js /var/www/sak-backend/dist/controllers/
sudo cp ~/backend-fix/dist/routes/department.routes.js /var/www/sak-backend/dist/routes/
sudo cp ~/backend-fix/dist/server.js /var/www/sak-backend/dist/

# Set permissions
echo ' Setting permissions...'
sudo chown -R ubuntu:ubuntu /var/www/sak-backend/dist/

# Restart PM2
echo ' Restarting backend...'
sudo pm2 restart sak-backend

# Show logs
echo ' Checking status...'
sudo pm2 logs sak-backend --lines 30 --nostream

echo ' Deployment complete!'
echo ' Test with: curl -H \"Authorization: Bearer YOUR_TOKEN\" https://sac.saksolution.com/api/v1/departments'
