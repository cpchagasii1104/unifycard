# Expansão do Sistema de Interesses e Gostos

## Objetivo

Criar um "raio-X" completo do usuário através de um sistema inteligente de coleta de interesses e gostos, permitindo matching preciso com:
- Restaurantes
- Bares
- Vida noturna
- Esportes
- Lazer
- Empresas
- Grupos
- Eventos
- Redes sociais

## Estrutura de Categorias Expandida

### 1. Gastronomia e Restaurantes
- **Tipos de Culinária**: Brasileira, Italiana, Japonesa, Chinesa, Mexicana, Francesa, Árabe, Indiana, Vegetariana, Vegana, Fast Food, Comida de Rua, Frutos do Mar, Churrascaria, Pizzaria
- **Ambientes de Restaurante**: Casual, Fine Dining, Romântico, Familiar, Ao Ar Livre, Food Truck, Café e Bistrô, Bar e Restaurante
- **Ocasões Gastronômicas**: Almoço de Negócios, Jantar Romântico, Brunch, Happy Hour, Café da Manhã, Lanche da Tarde

### 2. Bares e Bebidas
- **Tipos de Bares**: Cerveja Artesanal, Vinhos, Cocktail Bar, Pub, Esportivo, Temático, Ao Ar Livre, Rooftop, Praia, Noturno
- **Tipos de Bebidas**: Cerveja, Cerveja Artesanal, Vinho (Tinto/Branco), Espumante, Whisky, Coquetéis, Gin, Vodka, Rum, Cachaça, Caipirinha, Drinks Sem Álcool

### 3. Vida Noturna
- **Tipos de Locais Noturnos**: Balada, Boate, Casa de Shows, Karaokê, Bar com Música ao Vivo, Sertanejo, Funk, Eletrônica, Rock, Forró, Samba
- **Eventos Noturnos**: Festas Temáticas, Festas de Aniversário, After Hours, Raves, Festivais de Música, Open Bar, Noite de Gala

### 4. Esportes (expandido)
- Esportes coletivos, individuais, aquáticos, radicais, fitness, artes marciais

### 5. Lazer e Entretenimento (expandido)
- Atividades culturais, cinema, streaming, atividades sociais, atividades recreativas

### 6. Compras e Consumo
- Tipos de compras, interesses de consumo

## Sistema de Coleta Inteligente

### Perguntas Condicionais

O sistema deve fazer perguntas guiadas baseadas nas respostas anteriores:

1. **Gastronomia**:
   - "Você gosta de comer fora?" → Se SIM:
     - "Que tipo de comida prefere?" (múltipla escolha)
     - "Prefere ambiente casual ou sofisticado?"
     - "Gosta de brunch?" → Se SIM: mostrar opções de brunch

2. **Bares**:
   - "Você frequenta bares?" → Se SIM:
     - "Que tipo de bar prefere?" (múltipla escolha)
     - "Que bebidas prefere?" (múltipla escolha)

3. **Vida Noturna**:
   - "Você gosta de sair à noite?" → Se SIM:
     - "Que tipo de música prefere em baladas?"
     - "Prefere festas grandes ou eventos menores?"

### Estados de Interesse

Cada interesse pode ter estados qualitativos:
- **Gosto** - Aprecio, mas não pratico regularmente
- **Pratico às Vezes** - Faço ocasionalmente
- **Pratico Regularmente** - Faço com frequência

## Matching com Outros Módulos

### Empresas
- Restaurantes podem ser categorizados com as mesmas categorias de interesse
- Matching: usuários com interesse em "Culinária Japonesa" → restaurantes japoneses
- Matching: usuários com interesse em "Bar de Cerveja Artesanal" → bares especializados

### Grupos
- Grupos podem ser categorizados com interesses
- Matching: usuários com interesse em "Rock" → grupos de música rock
- Matching: usuários com interesse em "Futebol" → grupos de futebol

### Eventos
- Eventos podem ser categorizados com interesses
- Matching: usuários com interesse em "Festivais de Música" → eventos de música
- Matching: usuários com interesse em "Culinary Events" → eventos gastronômicos

### Redes Sociais
- Posts e conteúdo podem ser categorizados
- Feed personalizado baseado em interesses
- Sugestões de conteúdo relacionado

## Implementação Técnica

### Backend
1. **Seed de Categorias**: `backend/src/scripts/seed-interests-categories.ts`
   - Expandido com categorias de gastronomia, bares, vida noturna
   - Estrutura hierárquica em 3 níveis (level1, level2, level3)

2. **ProfilePhysical Service**: 
   - Usa `scope='interest'` para buscar categorias
   - Armazena interesses como `categoryId` (não texto livre)
   - Permite estados qualitativos por interesse

3. **Matching Service**:
   - Queries SQL para matching baseado em categorias
   - Matching com empresas, grupos, eventos

### Frontend
1. **ProfilePhysical Component**:
   - Refatorado para usar `getCategoryTree('interest')`
   - Interface guiada com perguntas condicionais
   - Seleção múltipla de interesses
   - Estados qualitativos (Gosto, Pratico às Vezes, Pratico Regularmente)

2. **Autocomplete Inteligente**:
   - Busca categorias de interesse
   - Sugestões baseadas em contexto

## Queries de Matching

### Matching com Restaurantes
```sql
SELECT DISTINCT c.company_id, c.company_name
FROM companies c
INNER JOIN company_categories cc ON c.company_id = cc.company_id
INNER JOIN categories cat ON cc.category_id = cat.category_id
INNER JOIN user_interests ui ON cat.category_id = ui.category_id
WHERE ui.user_id = $1
  AND cat.scope = 'interest'
  AND cat.slug IN ('culinaria-japonesa', 'culinaria-italiana', ...)
```

### Matching com Grupos
```sql
SELECT DISTINCT g.group_id, g.name
FROM groups g
INNER JOIN group_categories gc ON g.group_id = gc.group_id
INNER JOIN categories cat ON gc.category_id = cat.category_id
INNER JOIN user_interests ui ON cat.category_id = ui.category_id
WHERE ui.user_id = $1
  AND cat.scope = 'interest'
```

### Matching com Eventos
```sql
SELECT DISTINCT e.event_id, e.name
FROM events e
INNER JOIN event_categories ec ON e.event_id = ec.event_id
INNER JOIN categories cat ON ec.category_id = cat.category_id
INNER JOIN user_interests ui ON cat.category_id = ui.category_id
WHERE ui.user_id = $1
  AND cat.scope = 'interest'
  AND e.start_date >= NOW()
```

## Próximos Passos

1. ✅ Expandir seed de categorias (Gastronomia, Bares, Vida Noturna)
2. ⏳ Refatorar ProfilePhysical para usar categorias do backend
3. ⏳ Implementar perguntas condicionais
4. ⏳ Criar queries de matching
5. ⏳ Integrar com módulos de empresas, grupos, eventos





