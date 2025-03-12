module.exports = {
  apps: [{
    script: "dist/admin.js",
    name: 'bot_x_admin',
    watch: true,
    // max_memory_restart: '5000M',
    autorestart: false,
    exp_backoff_restart_delay: 100,
  }]
}