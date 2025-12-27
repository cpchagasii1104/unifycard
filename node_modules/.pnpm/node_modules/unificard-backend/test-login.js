// test-login.js
// Script simples para testar o login

const http = require('http');

const data = JSON.stringify({
  email: 'admin@unificard.com',
  password: '123456'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'x-tenant-id': '59c92efe-c358-4e74-82e3-123b07ab3be2'
  }
};

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', responseData);
    
    try {
      const parsed = JSON.parse(responseData);
      if (parsed.success && parsed.data && parsed.data.tokens) {
        console.log('\n✅ Login bem-sucedido!');
        console.log('\n📋 Token JWT (Access Token):');
        console.log(parsed.data.tokens.accessToken);
        console.log('\n📋 Refresh Token:');
        console.log(parsed.data.tokens.refreshToken);
      }
    } catch (e) {
      console.log('Erro ao parsear resposta:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro na requisição:', error.message);
  console.error('Certifique-se de que o servidor está rodando em http://localhost:3000');
});

req.write(data);
req.end();

