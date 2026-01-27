"use strict";
// src/scripts/seed-interests-categories.ts
// Seed de categorias de interesses/hobbies em 3 níveis hierárquicos
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * Estrutura de categorias de interesses em 3 níveis:
 * Nível 1: Grande área (Entretenimento, Esportes, Cultura, etc.)
 * Nível 2: Subcategoria (Jogos, Leitura, Cinema, etc.)
 * Nível 3: Interesse específico (RPG, Ficção Científica, Ação, etc.)
 */
const INTEREST_CATEGORIES = [
    // ============================================
    // ENTERTENIMENTO E JOGOS
    // ============================================
    {
        level1: { name: 'Entretenimento e Jogos', slug: 'entretenimento-jogos', description: 'Jogos, hobbies e entretenimento' },
        level2: [
            {
                name: 'Videogames',
                slug: 'videogames',
                description: 'Jogos eletrônicos',
                level3: [
                    { name: 'RPG', slug: 'rpg' },
                    { name: 'Ação', slug: 'acao' },
                    { name: 'Estratégia', slug: 'estrategia' },
                    { name: 'Esportes', slug: 'esportes' },
                    { name: 'Corrida', slug: 'corrida' },
                    { name: 'Luta', slug: 'luta' },
                    { name: 'Aventura', slug: 'aventura' },
                    { name: 'Puzzle', slug: 'puzzle' },
                    { name: 'Simulação', slug: 'simulacao' },
                ],
            },
            {
                name: 'Jogos de Mesa',
                slug: 'jogos-mesa',
                description: 'Jogos de tabuleiro e cartas',
                level3: [
                    { name: 'Xadrez', slug: 'xadrez' },
                    { name: 'Poker', slug: 'poker' },
                    { name: 'Jogos de Tabuleiro', slug: 'tabuleiro' },
                    { name: 'Magic: The Gathering', slug: 'magic' },
                    { name: 'Dungeons & Dragons', slug: 'dnd' },
                ],
            },
        ],
    },
    // ============================================
    // LEITURA E LITERATURA
    // ============================================
    {
        level1: { name: 'Leitura e Literatura', slug: 'leitura-literatura', description: 'Livros e leitura' },
        level2: [
            {
                name: 'Gêneros Literários',
                slug: 'generos-literarios',
                description: 'Tipos de leitura',
                level3: [
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica' },
                    { name: 'Fantasia', slug: 'fantasia' },
                    { name: 'Romance', slug: 'romance' },
                    { name: 'Suspense', slug: 'suspense' },
                    { name: 'Terror', slug: 'terror' },
                    { name: 'Biografia', slug: 'biografia' },
                    { name: 'História', slug: 'historia' },
                    { name: 'Filosofia', slug: 'filosofia' },
                    { name: 'Autoajuda', slug: 'autoajuda' },
                    { name: 'Negócios', slug: 'negocios' },
                ],
            },
            {
                name: 'Mangás e Quadrinhos',
                slug: 'mangas-quadrinhos',
                description: 'Histórias em quadrinhos',
                level3: [
                    { name: 'Mangá', slug: 'manga' },
                    { name: 'Comics', slug: 'comics' },
                    { name: 'Graphic Novels', slug: 'graphic-novels' },
                ],
            },
        ],
    },
    // ============================================
    // CINEMA E AUDIOVISUAL
    // ============================================
    {
        level1: { name: 'Cinema e Audiovisual', slug: 'cinema-audiovisual', description: 'Filmes, séries e vídeos' },
        level2: [
            {
                name: 'Gêneros de Filme',
                slug: 'generos-filme',
                description: 'Tipos de filmes',
                level3: [
                    { name: 'Ação', slug: 'acao-filme' },
                    { name: 'Comédia', slug: 'comedia' },
                    { name: 'Drama', slug: 'drama' },
                    { name: 'Terror', slug: 'terror-filme' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-filme' },
                    { name: 'Romance', slug: 'romance-filme' },
                    { name: 'Documentário', slug: 'documentario' },
                    { name: 'Animação', slug: 'animacao' },
                ],
            },
            {
                name: 'Séries',
                slug: 'series',
                description: 'Séries de TV e streaming',
                level3: [
                    { name: 'Drama', slug: 'drama-serie' },
                    { name: 'Comédia', slug: 'comedia-serie' },
                    { name: 'Suspense', slug: 'suspense-serie' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-serie' },
                    { name: 'Fantasia', slug: 'fantasia-serie' },
                ],
            },
        ],
    },
    // ============================================
    // MÚSICA
    // ============================================
    {
        level1: { name: 'Música', slug: 'musica', description: 'Música e sons' },
        level2: [
            {
                name: 'Gêneros Musicais',
                slug: 'generos-musicais',
                description: 'Estilos musicais',
                level3: [
                    { name: 'Rock', slug: 'rock' },
                    { name: 'Pop', slug: 'pop' },
                    { name: 'Sertanejo', slug: 'sertanejo' },
                    { name: 'Funk', slug: 'funk' },
                    { name: 'Hip Hop', slug: 'hip-hop' },
                    { name: 'Eletrônica', slug: 'eletronica' },
                    { name: 'Jazz', slug: 'jazz' },
                    { name: 'Clássica', slug: 'classica' },
                    { name: 'MPB', slug: 'mpb' },
                    { name: 'Reggae', slug: 'reggae' },
                ],
            },
            {
                name: 'Instrumentos',
                slug: 'instrumentos',
                description: 'Tocar instrumentos',
                level3: [
                    { name: 'Violão', slug: 'violao' },
                    { name: 'Guitarra', slug: 'guitarra' },
                    { name: 'Piano', slug: 'piano' },
                    { name: 'Bateria', slug: 'bateria' },
                    { name: 'Baixo', slug: 'baixo' },
                ],
            },
        ],
    },
    // ============================================
    // ARTE E CRIATIVIDADE
    // ============================================
    {
        level1: { name: 'Arte e Criatividade', slug: 'arte-criatividade', description: 'Artes e expressão criativa' },
        level2: [
            {
                name: 'Artes Visuais',
                slug: 'artes-visuais',
                description: 'Pintura, desenho, etc.',
                level3: [
                    { name: 'Pintura', slug: 'pintura' },
                    { name: 'Desenho', slug: 'desenho' },
                    { name: 'Fotografia', slug: 'fotografia' },
                    { name: 'Escultura', slug: 'escultura' },
                    { name: 'Arte Digital', slug: 'arte-digital' },
                ],
            },
            {
                name: 'Artesanato',
                slug: 'artesanato',
                description: 'Trabalhos manuais',
                level3: [
                    { name: 'Tricô', slug: 'trico' },
                    { name: 'Crochê', slug: 'croche' },
                    { name: 'Costura', slug: 'costura' },
                    { name: 'Marcenaria', slug: 'marcenaria' },
                ],
            },
        ],
    },
    // ============================================
    // ESPORTES E ATIVIDADES FÍSICAS
    // ============================================
    {
        level1: { name: 'Esportes e Atividades Físicas', slug: 'esportes-atividades', description: 'Esportes, exercícios e atividades físicas' },
        level2: [
            {
                name: 'Esportes Coletivos',
                slug: 'esportes-coletivos',
                description: 'Esportes em equipe',
                level3: [
                    { name: 'Futebol', slug: 'futebol' },
                    { name: 'Futebol de Areia', slug: 'futebol-areia' },
                    { name: 'Futsal', slug: 'futsal' },
                    { name: 'Basquete', slug: 'basquete' },
                    { name: 'Vôlei', slug: 'volei' },
                    { name: 'Vôlei de Praia', slug: 'volei-praia' },
                    { name: 'Handebol', slug: 'handebol' },
                    { name: 'Rugby', slug: 'rugby' },
                    { name: 'Beisebol', slug: 'beisebol' },
                    { name: 'Softball', slug: 'softball' },
                ],
            },
            {
                name: 'Esportes Individuais',
                slug: 'esportes-individuais',
                description: 'Esportes solo',
                level3: [
                    { name: 'Corrida', slug: 'corrida-esporte' },
                    { name: 'Corrida de Rua', slug: 'corrida-rua' },
                    { name: 'Ciclismo', slug: 'ciclismo' },
                    { name: 'Ciclismo de Estrada', slug: 'ciclismo-estrada' },
                    { name: 'Mountain Bike', slug: 'mountain-bike' },
                    { name: 'Natação', slug: 'natacao' },
                    { name: 'Tênis', slug: 'tenis' },
                    { name: 'Tênis de Mesa', slug: 'tenis-mesa' },
                    { name: 'Badminton', slug: 'badminton' },
                    { name: 'Squash', slug: 'squash' },
                    { name: 'Golfe', slug: 'golfe' },
                    { name: 'Tênis de Praia', slug: 'tenis-praia' },
                ],
            },
            {
                name: 'Fitness e Academia',
                slug: 'fitness-academia',
                description: 'Atividades de fitness',
                level3: [
                    { name: 'Musculação', slug: 'musculacao' },
                    { name: 'CrossFit', slug: 'crossfit' },
                    { name: 'Funcional', slug: 'funcional' },
                    { name: 'Yoga', slug: 'yoga' },
                    { name: 'Pilates', slug: 'pilates' },
                    { name: 'Spinning', slug: 'spinning' },
                    { name: 'Zumba', slug: 'zumba' },
                    { name: 'Dança Fitness', slug: 'danca-fitness' },
                    { name: 'HIIT', slug: 'hiit' },
                    { name: 'Bodybuilding', slug: 'bodybuilding' },
                ],
            },
            {
                name: 'Artes Marciais e Lutas',
                slug: 'artes-marciais-lutas',
                description: 'Artes marciais e esportes de combate',
                level3: [
                    { name: 'Jiu-Jitsu', slug: 'jiu-jitsu' },
                    { name: 'Muay Thai', slug: 'muay-thai' },
                    { name: 'Boxe', slug: 'boxe' },
                    { name: 'Karatê', slug: 'karate' },
                    { name: 'Taekwondo', slug: 'taekwondo' },
                    { name: 'Capoeira', slug: 'capoeira' },
                    { name: 'MMA', slug: 'mma' },
                    { name: 'Krav Maga', slug: 'krav-maga' },
                ],
            },
            {
                name: 'Esportes Aquáticos',
                slug: 'esportes-aquaticos',
                description: 'Esportes na água',
                level3: [
                    { name: 'Surf', slug: 'surf' },
                    { name: 'Stand Up Paddle', slug: 'stand-up-paddle' },
                    { name: 'Kitesurf', slug: 'kitesurf' },
                    { name: 'Windsurf', slug: 'windsurf' },
                    { name: 'Wakeboard', slug: 'wakeboard' },
                    { name: 'Mergulho', slug: 'mergulho' },
                    { name: 'Natação em Águas Abertas', slug: 'natacao-aguas-abertas' },
                ],
            },
            {
                name: 'Esportes Radicais',
                slug: 'esportes-radicais',
                description: 'Esportes de aventura',
                level3: [
                    { name: 'Escalada', slug: 'escalada' },
                    { name: 'Rapel', slug: 'rapel' },
                    { name: 'Paraquedismo', slug: 'paraquedismo' },
                    { name: 'Bungee Jump', slug: 'bungee-jump' },
                    { name: 'Skate', slug: 'skate' },
                    { name: 'Patins', slug: 'patins' },
                    { name: 'BMX', slug: 'bmx' },
                    { name: 'Parkour', slug: 'parkour' },
                ],
            },
        ],
    },
    // ============================================
    // GASTRONOMIA E ALIMENTAÇÃO
    // ============================================
    {
        level1: { name: 'Gastronomia e Alimentação', slug: 'gastronomia-alimentacao', description: 'Culinária, restaurantes e comida' },
        level2: [
            {
                name: 'Cozinhar',
                slug: 'cozinhar',
                description: 'Preparar comida',
                level3: [
                    { name: 'Culinária Brasileira', slug: 'culinaria-brasileira' },
                    { name: 'Culinária Italiana', slug: 'culinaria-italiana' },
                    { name: 'Culinária Japonesa', slug: 'culinaria-japonesa' },
                    { name: 'Culinária Mexicana', slug: 'culinaria-mexicana' },
                    { name: 'Culinária Francesa', slug: 'culinaria-francesa' },
                    { name: 'Culinária Árabe', slug: 'culinaria-arabe' },
                    { name: 'Culinária Chinesa', slug: 'culinaria-chinesa' },
                    { name: 'Culinária Tailandesa', slug: 'culinaria-tailandesa' },
                    { name: 'Culinária Indiana', slug: 'culinaria-indiana' },
                    { name: 'Sobremesas', slug: 'sobremesas' },
                    { name: 'Churrasco', slug: 'churrasco' },
                    { name: 'Padaria e Confeitaria', slug: 'padaria-confeitaria' },
                ],
            },
            {
                name: 'Tipos de Restaurante',
                slug: 'tipos-restaurante',
                description: 'Estilos de restaurantes que frequenta',
                level3: [
                    { name: 'Restaurante à La Carte', slug: 'restaurante-la-carte' },
                    { name: 'Rodízio', slug: 'rodizio' },
                    { name: 'Self-Service', slug: 'self-service' },
                    { name: 'Fast Food', slug: 'fast-food' },
                    { name: 'Restaurante Vegano', slug: 'restaurante-vegano' },
                    { name: 'Restaurante Vegetariano', slug: 'restaurante-vegetariano' },
                    { name: 'Restaurante Fitness', slug: 'restaurante-fitness' },
                    { name: 'Restaurante Gourmet', slug: 'restaurante-gourmet' },
                    { name: 'Restaurante Casual', slug: 'restaurante-casual' },
                    { name: 'Restaurante Fine Dining', slug: 'restaurante-fine-dining' },
                    { name: 'Pizzaria', slug: 'pizzaria' },
                    { name: 'Hamburgueria', slug: 'hamburgueria' },
                    { name: 'Sushi Bar', slug: 'sushi-bar' },
                    { name: 'Churrascaria', slug: 'churrascaria' },
                ],
            },
            {
                name: 'Bares e Vida Noturna',
                slug: 'bares-vida-noturna',
                description: 'Estabelecimentos noturnos e bares',
                level3: [
                    { name: 'Bar Tradicional', slug: 'bar-tradicional' },
                    { name: 'Pub', slug: 'pub' },
                    { name: 'Bar de Cerveja Artesanal', slug: 'bar-cerveja-artesanal' },
                    { name: 'Cocktail Bar', slug: 'cocktail-bar' },
                    { name: 'Wine Bar', slug: 'wine-bar' },
                    { name: 'Karaokê', slug: 'karaoke' },
                    { name: 'Balada', slug: 'balada' },
                    { name: 'Boate', slug: 'boate' },
                    { name: 'Festa Rave', slug: 'festa-rave' },
                    { name: 'Bar Esportivo', slug: 'bar-esportivo' },
                    { name: 'Bar ao Ar Livre', slug: 'bar-ao-ar-livre' },
                    { name: 'Bar Temático', slug: 'bar-tematico' },
                ],
            },
            {
                name: 'Cafeterias e Lanchonetes',
                slug: 'cafeterias-lanchonetes',
                description: 'Cafés e lanchonetes',
                level3: [
                    { name: 'Cafeteria', slug: 'cafeteria' },
                    { name: 'Café Especializado', slug: 'cafe-especializado' },
                    { name: 'Lanchonete', slug: 'lanchonete' },
                    { name: 'Food Truck', slug: 'food-truck' },
                    { name: 'Açaí', slug: 'acai' },
                    { name: 'Sorveteria', slug: 'sorveteria' },
                ],
            },
        ],
    },
    // ============================================
    // NATUREZA E AR LIVRE
    // ============================================
    {
        level1: { name: 'Natureza e Ar Livre', slug: 'natureza-ar-livre', description: 'Atividades ao ar livre e natureza' },
        level2: [
            {
                name: 'Atividades na Natureza',
                slug: 'atividades-natureza',
                description: 'Contato com natureza',
                level3: [
                    { name: 'Caminhada', slug: 'caminhada' },
                    { name: 'Trilha', slug: 'trilha' },
                    { name: 'Trekking', slug: 'trekking' },
                    { name: 'Acampamento', slug: 'acampamento' },
                    { name: 'Pesca', slug: 'pesca' },
                    { name: 'Pesca Esportiva', slug: 'pesca-esportiva' },
                    { name: 'Praia', slug: 'praia' },
                    { name: 'Praia e Sol', slug: 'praia-sol' },
                    { name: 'Banho de Cachoeira', slug: 'banho-cachoeira' },
                    { name: 'Observação de Aves', slug: 'observacao-aves' },
                    { name: 'Fotografia de Natureza', slug: 'fotografia-natureza' },
                ],
            },
            {
                name: 'Viagens e Turismo',
                slug: 'viagens-turismo',
                description: 'Viagens e turismo',
                level3: [
                    { name: 'Viagens Nacionais', slug: 'viagens-nacionais' },
                    { name: 'Viagens Internacionais', slug: 'viagens-internacionais' },
                    { name: 'Turismo de Aventura', slug: 'turismo-aventura' },
                    { name: 'Turismo Cultural', slug: 'turismo-cultural' },
                    { name: 'Turismo de Praia', slug: 'turismo-praia' },
                    { name: 'Turismo de Montanha', slug: 'turismo-montanha' },
                    { name: 'Mochilão', slug: 'mochilao' },
                    { name: 'Road Trip', slug: 'road-trip' },
                ],
            },
        ],
    },
    // ============================================
    // LAZER E ENTRETENIMENTO
    // ============================================
    {
        level1: { name: 'Lazer e Entretenimento', slug: 'lazer-entretenimento', description: 'Atividades de lazer e entretenimento' },
        level2: [
            {
                name: 'Atividades Culturais',
                slug: 'atividades-culturais',
                description: 'Eventos e atividades culturais',
                level3: [
                    { name: 'Teatro', slug: 'teatro' },
                    { name: 'Shows', slug: 'shows' },
                    { name: 'Festivais de Música', slug: 'festivais-musica' },
                    { name: 'Festivais Culturais', slug: 'festivais-culturais' },
                    { name: 'Museus', slug: 'museus' },
                    { name: 'Galerias de Arte', slug: 'galerias-arte' },
                    { name: 'Exposições', slug: 'exposicoes' },
                    { name: 'Feiras de Arte', slug: 'feiras-arte' },
                    { name: 'Saraus', slug: 'saraus' },
                    { name: 'Poesia', slug: 'poesia' },
                ],
            },
            {
                name: 'Cinema e Streaming',
                slug: 'cinema-streaming',
                description: 'Filmes e séries',
                level3: [
                    { name: 'Cinema', slug: 'cinema' },
                    { name: 'Cinema ao Ar Livre', slug: 'cinema-ar-livre' },
                    { name: 'Festivais de Cinema', slug: 'festivais-cinema' },
                    { name: 'Séries', slug: 'series' },
                    { name: 'Documentários', slug: 'documentarios' },
                ],
            },
            {
                name: 'Atividades Sociais',
                slug: 'atividades-sociais',
                description: 'Atividades em grupo',
                level3: [
                    { name: 'Happy Hour', slug: 'happy-hour' },
                    { name: 'Encontros Sociais', slug: 'encontros-sociais' },
                    { name: 'Networking', slug: 'networking' },
                    { name: 'Eventos Corporativos', slug: 'eventos-corporativos' },
                    { name: 'Festas', slug: 'festas' },
                    { name: 'Aniversários', slug: 'aniversarios' },
                    { name: 'Casamentos', slug: 'casamentos' },
                ],
            },
            {
                name: 'Atividades Recreativas',
                slug: 'atividades-recreativas',
                description: 'Diversão e recreação',
                level3: [
                    { name: 'Kart', slug: 'kart' },
                    { name: 'Boliche', slug: 'boliche' },
                    { name: 'Escape Room', slug: 'escape-room' },
                    { name: 'Paintball', slug: 'paintball' },
                    { name: 'Laser Tag', slug: 'laser-tag' },
                    { name: 'Realidade Virtual', slug: 'realidade-virtual' },
                    { name: 'Parques de Diversão', slug: 'parques-diversao' },
                    { name: 'Parques Temáticos', slug: 'parques-tematicos' },
                ],
            },
        ],
    },
    // ============================================
    // GASTRONOMIA E RESTAURANTES
    // ============================================
    {
        level1: { name: 'Gastronomia e Restaurantes', slug: 'gastronomia-restaurantes', description: 'Restaurantes, comida e gastronomia' },
        level2: [
            {
                name: 'Tipos de Culinária',
                slug: 'tipos-culinaria',
                description: 'Estilos culinários preferidos',
                level3: [
                    { name: 'Brasileira', slug: 'culinaria-brasileira' },
                    { name: 'Italiana', slug: 'culinaria-italiana' },
                    { name: 'Japonesa', slug: 'culinaria-japonesa' },
                    { name: 'Chinesa', slug: 'culinaria-chinesa' },
                    { name: 'Mexicana', slug: 'culinaria-mexicana' },
                    { name: 'Francesa', slug: 'culinaria-francesa' },
                    { name: 'Árabe', slug: 'culinaria-arabe' },
                    { name: 'Indiana', slug: 'culinaria-indiana' },
                    { name: 'Vegetariana', slug: 'culinaria-vegetariana' },
                    { name: 'Vegana', slug: 'culinaria-vegana' },
                    { name: 'Fast Food', slug: 'fast-food' },
                    { name: 'Comida de Rua', slug: 'comida-rua' },
                    { name: 'Frutos do Mar', slug: 'frutos-mar' },
                    { name: 'Churrascaria', slug: 'churrascaria' },
                    { name: 'Pizzaria', slug: 'pizzaria' },
                ],
            },
            {
                name: 'Ambientes de Restaurante',
                slug: 'ambientes-restaurante',
                description: 'Tipos de ambiente preferidos',
                level3: [
                    { name: 'Restaurante Casual', slug: 'restaurante-casual' },
                    { name: 'Restaurante Fine Dining', slug: 'restaurante-fine-dining' },
                    { name: 'Restaurante Romântico', slug: 'restaurante-romantico' },
                    { name: 'Restaurante Familiar', slug: 'restaurante-familiar' },
                    { name: 'Restaurante ao Ar Livre', slug: 'restaurante-ar-livre' },
                    { name: 'Food Truck', slug: 'food-truck' },
                    { name: 'Café e Bistrô', slug: 'cafe-bistro' },
                    { name: 'Bar e Restaurante', slug: 'bar-restaurante' },
                ],
            },
            {
                name: 'Ocasões Gastronômicas',
                slug: 'ocoes-gastronomicas',
                description: 'Quando gosta de comer fora',
                level3: [
                    { name: 'Almoço de Negócios', slug: 'almoco-negocios' },
                    { name: 'Jantar Romântico', slug: 'jantar-romantico' },
                    { name: 'Brunch', slug: 'brunch' },
                    { name: 'Happy Hour', slug: 'happy-hour-gastronomia' },
                    { name: 'Café da Manhã', slug: 'cafe-manha' },
                    { name: 'Lanche da Tarde', slug: 'lanche-tarde' },
                ],
            },
        ],
    },
    // ============================================
    // BARES E BEBIDAS
    // ============================================
    {
        level1: { name: 'Bares e Bebidas', slug: 'bares-bebidas', description: 'Bares, drinks e vida noturna' },
        level2: [
            {
                name: 'Tipos de Bares',
                slug: 'tipos-bares',
                description: 'Estilos de bares preferidos',
                level3: [
                    { name: 'Bar de Cerveja Artesanal', slug: 'bar-cerveja-artesanal' },
                    { name: 'Bar de Vinhos', slug: 'bar-vinhos' },
                    { name: 'Cocktail Bar', slug: 'cocktail-bar' },
                    { name: 'Pub', slug: 'pub' },
                    { name: 'Bar Esportivo', slug: 'bar-esportivo' },
                    { name: 'Bar Temático', slug: 'bar-tematico' },
                    { name: 'Bar ao Ar Livre', slug: 'bar-ar-livre' },
                    { name: 'Rooftop Bar', slug: 'rooftop-bar' },
                    { name: 'Bar de Praia', slug: 'bar-praia' },
                    { name: 'Bar Noturno', slug: 'bar-noturno' },
                ],
            },
            {
                name: 'Tipos de Bebidas',
                slug: 'tipos-bebidas',
                description: 'Bebidas preferidas',
                level3: [
                    { name: 'Cerveja', slug: 'cerveja' },
                    { name: 'Cerveja Artesanal', slug: 'cerveja-artesanal' },
                    { name: 'Vinho', slug: 'vinho' },
                    { name: 'Vinho Tinto', slug: 'vinho-tinto' },
                    { name: 'Vinho Branco', slug: 'vinho-branco' },
                    { name: 'Espumante', slug: 'espumante' },
                    { name: 'Whisky', slug: 'whisky' },
                    { name: 'Coquetéis', slug: 'coqueteis' },
                    { name: 'Gin', slug: 'gin' },
                    { name: 'Vodka', slug: 'vodka' },
                    { name: 'Rum', slug: 'rum' },
                    { name: 'Cachaça', slug: 'cachaca' },
                    { name: 'Caipirinha', slug: 'caipirinha' },
                    { name: 'Drinks Sem Álcool', slug: 'drinks-sem-alcool' },
                ],
            },
        ],
    },
    // ============================================
    // VIDA NOTURNA
    // ============================================
    {
        level1: { name: 'Vida Noturna', slug: 'vida-noturna', description: 'Baladas, festas e eventos noturnos' },
        level2: [
            {
                name: 'Tipos de Locais Noturnos',
                slug: 'tipos-locais-noturnos',
                description: 'Onde gosta de sair à noite',
                level3: [
                    { name: 'Balada', slug: 'balada' },
                    { name: 'Boate', slug: 'boate' },
                    { name: 'Casa de Shows', slug: 'casa-shows' },
                    { name: 'Karaokê', slug: 'karaoke' },
                    { name: 'Bar com Música ao Vivo', slug: 'bar-musica-vivo' },
                    { name: 'Sertanejo', slug: 'sertanejo-noturno' },
                    { name: 'Funk', slug: 'funk-noturno' },
                    { name: 'Eletrônica', slug: 'eletronica-noturno' },
                    { name: 'Rock', slug: 'rock-noturno' },
                    { name: 'Forró', slug: 'forro-noturno' },
                    { name: 'Samba', slug: 'samba-noturno' },
                ],
            },
            {
                name: 'Eventos Noturnos',
                slug: 'eventos-noturnos',
                description: 'Tipos de eventos noturnos',
                level3: [
                    { name: 'Festas Temáticas', slug: 'festas-tematicas' },
                    { name: 'Festas de Aniversário', slug: 'festas-aniversario' },
                    { name: 'After Hours', slug: 'after-hours' },
                    { name: 'Raves', slug: 'raves' },
                    { name: 'Festivais de Música', slug: 'festivais-musica-noturno' },
                    { name: 'Open Bar', slug: 'open-bar' },
                    { name: 'Noite de Gala', slug: 'noite-gala' },
                ],
            },
        ],
    },
    // ============================================
    // COMPRAS E CONSUMO
    // ============================================
    {
        level1: { name: 'Compras e Consumo', slug: 'compras-consumo', description: 'Compras e consumo' },
        level2: [
            {
                name: 'Tipos de Compras',
                slug: 'tipos-compras',
                description: 'Onde e como compra',
                level3: [
                    { name: 'Shopping Center', slug: 'shopping-center' },
                    { name: 'Feiras Livres', slug: 'feiras-livres' },
                    { name: 'Feiras de Artesanato', slug: 'feiras-artesanato' },
                    { name: 'Mercados Locais', slug: 'mercados-locais' },
                    { name: 'Compras Online', slug: 'compras-online' },
                    { name: 'Brechós', slug: 'brechos' },
                    { name: 'Vintage', slug: 'vintage' },
                    { name: 'Luxo', slug: 'luxo' },
                ],
            },
            {
                name: 'Interesses de Consumo',
                slug: 'interesses-consumo',
                description: 'O que gosta de comprar',
                level3: [
                    { name: 'Moda', slug: 'moda' },
                    { name: 'Tecnologia', slug: 'tecnologia-consumo' },
                    { name: 'Livros', slug: 'livros-consumo' },
                    { name: 'Decoração', slug: 'decoracao' },
                    { name: 'Plantas', slug: 'plantas' },
                    { name: 'Cosméticos', slug: 'cosmeticos' },
                    { name: 'Perfumes', slug: 'perfumes' },
                ],
            },
        ],
    },
];
/**
 * ⚠️ UNSAFE SCRIPT - APENAS PARA DESENVOLVIMENTO
 * GOVERNANÇA: Este script cria categorias como 'active' diretamente
 * NUNCA executar em produção sem revisão manual
 */
async function seedInterests() {
    // GOVERNANÇA: Validar ambiente
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
    }
    console.log('🌱 Iniciando seed de categorias de interesses...\n');
    console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');
    let totalCreated = 0;
    for (const categoryGroup of INTEREST_CATEGORIES) {
        try {
            // Criar nível 1 (Grande área)
            console.log(`📁 Criando categoria: ${categoryGroup.level1.name}`);
            const level1Category = await categories_service_1.categoriesService.createCategory({
                name: categoryGroup.level1.name,
                slug: categoryGroup.level1.slug,
                description: categoryGroup.level1.description,
                parentId: null,
                allowActive: true, // GOVERNANÇA: Flag explícita para script
                createdBy: {
                    source: 'script',
                },
            }, {
                validateAdmin: false, // Scripts não validam admin
            });
            totalCreated++;
            console.log(`   ✅ Criada: ${level1Category.name} (${level1Category.categoryId})`);
            // Criar nível 2 (Subcategorias)
            for (const level2Item of categoryGroup.level2) {
                console.log(`  📂 Criando subcategoria: ${level2Item.name}`);
                const level2Category = await categories_service_1.categoriesService.createCategory({
                    name: level2Item.name,
                    slug: level2Item.slug,
                    description: level2Item.description,
                    parentId: level1Category.categoryId,
                    allowActive: true,
                    createdBy: {
                        source: 'script',
                    },
                }, {
                    validateAdmin: false,
                });
                totalCreated++;
                console.log(`     ✅ Criada: ${level2Category.name} (${level2Category.categoryId})`);
                // Criar nível 3 (Interesses específicos)
                for (const level3Item of level2Item.level3) {
                    try {
                        const level3Category = await categories_service_1.categoriesService.createCategory({
                            name: level3Item.name,
                            slug: level3Item.slug,
                            description: null,
                            parentId: level2Category.categoryId,
                            allowActive: true,
                            createdBy: {
                                source: 'script',
                            },
                        }, {
                            validateAdmin: false,
                        });
                        totalCreated++;
                        console.log(`       ✅ Criada: ${level3Category.name} (${level3Category.categoryId})`);
                    }
                    catch (error) {
                        console.log(`       ⚠️  Já existe ou erro: ${level3Item.name} - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                }
            }
            console.log('');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('já existe')) {
                console.log(`   ⚠️  Categoria "${categoryGroup.level1.name}" já existe, pulando...\n`);
            }
            else {
                console.error(`   ❌ Erro ao criar categoria "${categoryGroup.level1.name}":`, error);
                console.log('');
            }
        }
    }
    console.log(`\n✨ Seed concluído! Total de categorias criadas: ${totalCreated}`);
    console.log('\n💡 Nota: Categorias que já existiam foram ignoradas (idempotente)');
}
// Executar seed
seedInterests()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
