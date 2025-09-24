import React from 'react';

const HomePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 via-white to-white">
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-2xl px-8 py-10 text-gray-800">
      <div className="mb-6 text-center">
        <img
          src="https://cdn-icons-png.flaticon.com/512/854/854878.png"
          alt="Logo"
          className="w-20 h-20 mx-auto mb-2 animate-bounce"
          draggable="false"
        />
        <h1 className="text-4xl font-extrabold text-blue-700 mb-2">UnifyCard</h1>
        <p className="text-lg text-gray-600 font-medium">
          Uma plataforma moderna para cadastro, gestão e integração de usuários.
        </p>
      </div>

      <ul className="space-y-2 mb-8">
        <li>
          <span className="font-bold text-blue-600">Cadastro Seguro:</span> 
          CPF criptografado, validação automática, e total proteção dos seus dados.
        </li>
        <li>
          <span className="font-bold text-blue-600">Login Instantâneo:</span> 
          Sistema de autenticação com feedback em tempo real.
        </li>
        <li>
          <span className="font-bold text-blue-600">Dashboard Interativo:</span> 
          Visualize seus dados, gerencie contas e veja seu histórico em poucos cliques.
        </li>
        <li>
          <span className="font-bold text-blue-600">Fácil Integração:</span> 
          Pronto para evoluir, integrar marketplace, financeiro e muito mais.
        </li>
      </ul>

      <div className="flex justify-center gap-4">
        <a
          href="/signup"
          className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-2 px-6 rounded-xl shadow-lg focus:outline-none"
        >
          Comece Agora
        </a>
        <a
          href="/login"
          className="bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 transition font-semibold py-2 px-6 rounded-xl shadow focus:outline-none"
        >
          Já tenho conta
        </a>
      </div>

      <footer className="mt-8 text-xs text-gray-400 text-center">
        &copy; {new Date().getFullYear()} UnifyCard. Código limpo, zero enrolação.
      </footer>
    </div>
  </div>
);

export default HomePage;
