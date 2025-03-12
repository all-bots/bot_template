module.exports = {
  apps: [{
    script: "dist/index.js",
    name: 'bot_x',
    watch: true,
    // max_memory_restart: '5000M',
    autorestart: false,
    exp_backoff_restart_delay: 100,
  }]
}