import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-pink-50 to-indigo-100">
      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center py-16 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 mb-6 drop-shadow-lg">
          Esqueça tudo o que você já viu sobre aplicativos, redes sociais, bancos ou formas de interação entre a sociedade.
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold text-blue-800 mb-4">
          Chegou o UnifyCard, o passaporte para o futuro em que seremos mais prósperos.
        </h2>
        <p className="text-lg md:text-xl text-blue-900 mb-4 max-w-2xl mx-auto">
          <span className="font-bold text-indigo-700">
            Cuide de mim que eu cuidarei de você,
          </span>{" "}
          pois não faz mais sentido enriquecer corporações que retiram o dinheiro da sua região e enriquecem meia dúzia de pessoas que nem te conhecem.
        </p>
        <div className="bg-gradient-to-r from-pink-200 via-blue-100 to-indigo-100 px-6 py-4 rounded-xl shadow-lg mb-6 mt-2">
          <span className="text-2xl md:text-3xl font-extrabold text-pink-700 tracking-wide">
            JUNTOS SOMOS O MUNDO À NOSSA VOLTA!
          </span>
        </div>
        {/* Botões de navegação */}
        <div className="flex flex-col md:flex-row gap-6 mt-8 w-full max-w-lg mx-auto justify-center">
          <Link
            to="/signup"
            className="flex-1 px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full text-white font-bold text-lg shadow-lg hover:scale-105 hover:bg-indigo-700 transition text-center"
          >
            Quero participar
          </Link>
          <Link
            to="/about"
            className="flex-1 px-8 py-4 bg-gradient-to-r from-pink-500 to-pink-400 rounded-full text-white font-bold text-lg shadow-lg hover:scale-105 hover:bg-pink-600 transition text-center"
          >
            Quero saber mais
          </Link>
          <Link
            to="/login"
            className="flex-1 px-8 py-4 border-2 border-indigo-500 rounded-full text-indigo-700 font-bold text-lg shadow-md hover:bg-indigo-100 transition text-center"
          >
            Acessar minha conta
          </Link>
        </div>
      </section>

      {/* SOBRE O UNIFYCARD */}
      <section className="max-w-4xl mx-auto px-6 py-12 bg-white/70 rounded-3xl shadow-xl mb-12">
        <h3 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6 text-center">
          O que o UnifyCard oferece?
        </h3>
        <ul className="space-y-4 text-lg text-blue-900">
          <li>
            <b>Reciprocidade real:</b> Parte do lucro de cada serviço (marketplace, delivery, banking, eventos, promoções) volta para a sua comunidade, grupos sociais e para você.
          </li>
          <li>
            <b>Economia local fortalecida:</b> O dinheiro gerado circula dentro da sua região e financia projetos, ações sociais e promoções para quem mais participa e movimenta.
          </li>
          <li>
            <b>Liberdade e pertencimento:</b> Escolha seus grupos, participe das decisões e do futuro do seu ecossistema. O UnifyCard é uma rede aberta, ética e feita por pessoas, para pessoas.
          </li>
          <li>
            <b>Tudo em um só lugar:</b> Transferências, compras, vendas, eventos, promoções, campanhas, networking, doações e muito mais — integrado, fácil e seguro.
          </li>
          <li>
            <b>Transparência total:</b> Você acompanha, vota e decide junto. Ninguém lucra sozinho: o valor retorna para todos.
          </li>
        </ul>
      </section>

      {/* FOOTER */}
      <footer className="w-full py-6 bg-gradient-to-r from-indigo-900 to-blue-800 text-blue-100 flex flex-col items-center mt-auto">
        <span className="text-base mb-1 font-semibold tracking-wide">
          UnifyCard • Plataforma aberta, ética e colaborativa
        </span>
        <span className="text-sm text-blue-200">
          {new Date().getFullYear()} &copy; UnifyCard. Prosperidade compartilhada.
        </span>
      </footer>
    </main>
  );
}
