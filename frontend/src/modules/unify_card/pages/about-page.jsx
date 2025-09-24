import React from "react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-pink-50 to-indigo-100">
      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center py-16 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 mb-5 drop-shadow-lg">
          Por que existe o UnifyCard?
        </h1>
        <p className="text-lg md:text-xl text-blue-900 max-w-2xl mb-8">
          O UnifyCard nasceu da vontade de transformar a relação entre pessoas, dinheiro e comunidade.  
          Não faz sentido que bancos, apps e grandes corporações concentrem riqueza e decidam o futuro das cidades, dos bairros e dos grupos sociais.  
          <span className="block font-bold text-pink-700 mt-4">
            Nosso propósito é devolver o poder para quem movimenta a economia de verdade: <span className="text-indigo-900">VOCÊ e a SUA REDE.</span>
          </span>
        </p>
        <div className="bg-gradient-to-r from-pink-200 via-blue-100 to-indigo-100 px-6 py-3 rounded-xl shadow-lg mb-10 mt-2">
          <span className="text-2xl md:text-3xl font-extrabold text-pink-700 tracking-wide">
            Juntos, cuidamos uns dos outros. Juntos, somos o mundo à nossa volta.
          </span>
        </div>
      </section>

      {/* VISÃO E DIFERENCIAIS */}
      <section className="max-w-3xl mx-auto px-6 py-8 bg-white/80 rounded-3xl shadow-xl mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6 text-center">
          O que torna o UnifyCard único?
        </h2>
        <ul className="space-y-6 text-lg text-blue-900">
          <li>
            <b>Distribuição justa dos lucros:</b> Parte de toda receita do sistema retorna diretamente para a conta regional, para os grupos sociais que participam e para as pessoas que mais movimentam e indicam.
          </li>
          <li>
            <b>Democracia e participação:</b> Você pode votar, sugerir, propor e acompanhar tudo que é feito com o saldo coletivo da sua comunidade.
          </li>
          <li>
            <b>Ecossistema unificado:</b> Pagamentos, marketplace, delivery, promoções, eventos, rede social, apoio a projetos e campanhas — tudo integrado, prático, seguro e transparente.
          </li>
          <li>
            <b>Respeito e privacidade:</b> Seus dados são seus, o controle é seu. Ninguém lucra escondido, ninguém explora sua região.  
          </li>
          <li>
            <b>Foco no local, visão global:</b> Quanto mais você movimenta e incentiva o UnifyCard, mais sua cidade, bairro, grupo social e causa prosperam.
          </li>
        </ul>
      </section>

      {/* CHAMADA PARA AÇÃO */}
      <section className="w-full flex flex-col items-center mb-12">
        <h3 className="text-xl md:text-2xl text-indigo-800 font-bold mb-3">
          Pronto para fazer parte da mudança?
        </h3>
        <div className="flex flex-col md:flex-row gap-6 mt-3 w-full max-w-md mx-auto justify-center">
          <Link
            to="/signup"
            className="flex-1 px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full text-white font-bold text-lg shadow-lg hover:scale-105 hover:bg-indigo-700 transition text-center"
          >
            Quero participar
          </Link>
          <Link
            to="/"
            className="flex-1 px-8 py-4 border-2 border-indigo-500 rounded-full text-indigo-700 font-bold text-lg shadow-md hover:bg-indigo-100 transition text-center"
          >
            Voltar para a Home
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full py-6 bg-gradient-to-r from-indigo-900 to-blue-800 text-blue-100 flex flex-col items-center mt-auto">
        <span className="text-base mb-1 font-semibold tracking-wide">
          UnifyCard • Prosperidade é compartilhar
        </span>
        <span className="text-sm text-blue-200">
          {new Date().getFullYear()} &copy; UnifyCard. Juntos somos mais fortes.
        </span>
      </footer>
    </main>
  );
}
