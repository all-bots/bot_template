module.exports = {
    apps : [{
      script    : "dist/services/generateWallet.js",
      name      : 'bot_x_gen_wallet',
      watch     : true,
      autorestart: false,
      exp_backoff_restart_delay: 100,
    }]
}