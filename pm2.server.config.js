module.exports = {
    apps : [{
      script    : "dist/server.js",
      name      : 'bot_x_server',
      watch     : true,
      autorestart: false,
      exp_backoff_restart_delay: 100,
    }]
}