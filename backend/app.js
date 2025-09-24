const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./config/db');

// Middlewares globais
app.use(cors());
app.use(express.json());

// Rotas unificadas de usuário
const userRoutes = require('./modules/user/routes/user-routes');
// Rotas adicionais necessárias para login, enums e hobbies
const loginRoutes = require('./modules/user/routes/login-routes');
const enumRoutes = require('./routes/enum-routes');
const hobbyRoutes = require('./routes/hobby-routes');

// Registrar rotas no prefixo /api
app.use('/api', userRoutes);
// Rota de login pública (POST /api/login)
app.use('/api/login', loginRoutes);
// Rotas de enums (ex.: /api/enums/profession-sector)
app.use('/api/enums', enumRoutes);
// Rotas de hobbies (ex.: /api/hobbies/categories)
app.use('/api/hobbies', hobbyRoutes);

// Rota padrão
app.get('/', (req, res) => {
  res.send('API do UnifyCard em execução!');
});

// Inicialização
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor backend iniciado em http://localhost:${PORT}`);
});

// Rota de saúde para testes automáticos
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = app;

// teste watcher
