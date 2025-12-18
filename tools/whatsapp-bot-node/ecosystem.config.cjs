module.exports = {
  apps: [{
    name: 'sak-webhook-bot',
    script: './server.js',
    cwd: '/home/ubuntu/SAK-Smart-Access-Control/whatsapp-bot-node',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
    },
    env_file: '.env',
    time: true,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
};
