const { chromium } = require('playwright');
const fs = require('fs');

async function checkSession() {
  const sessionPath = 'instagram_session.json';
  console.log('Session file exists:', fs.existsSync(sessionPath));
}

checkSession();
