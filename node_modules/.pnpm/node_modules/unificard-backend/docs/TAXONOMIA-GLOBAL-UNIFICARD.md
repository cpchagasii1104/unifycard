# TAXONOMIA GLOBAL UNIFICARD

## Comandos de Importação Sequencial

### 1. SERVIÇOS AUTOMOTIVOS

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Serviços Automotivos",
  "slug": "servicos-automotivos",
  "description": "Serviços relacionados a veículos automotores"
}
```

#### Subcategorias (parentId = ID de "servicos-automotivos")

**Manutenção e Reparo**
```json
POST /categories/create-child
{
  "name": "Manutenção e Reparo",
  "slug": "manutencao-reparo",
  "description": "Serviços de manutenção e reparo de veículos",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias (parentId = ID de "manutencao-reparo")**
- Troca de Óleo (slug: troca-oleo)
- Alinhamento e Balanceamento (slug: alinhamento-balanceamento)
- Reparo de Motor (slug: reparo-motor)
- Reparo de Transmissão (slug: reparo-transmissao)
- Sistema de Freios (slug: sistema-freios)
- Sistema Elétrico (slug: sistema-eletrico)
- Ar Condicionado (slug: ar-condicionado)
- Suspensão (slug: suspensao)

**Lavagem e Detalhamento**
```json
POST /categories/create-child
{
  "name": "Lavagem e Detalhamento",
  "slug": "lavagem-detalhamento",
  "description": "Serviços de limpeza e estética automotiva",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Lavagem Simples (slug: lavagem-simples)
- Lavagem Completa (slug: lavagem-completa)
- Detalhamento Premium (slug: detalhamento-premium)
- Enceramento (slug: enceramento)
- Hidratação de Couro (slug: hidratacao-couro)
- Polimento (slug: polimento)

**Pneus e Rodas**
```json
POST /categories/create-child
{
  "name": "Pneus e Rodas",
  "slug": "pneus-rodas",
  "description": "Serviços relacionados a pneus e rodas",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Venda de Pneus (slug: venda-pneus)
- Montagem de Pneus (slug: montagem-pneus)
- Calibragem (slug: calibragem)
- Recauchutagem (slug: recauchutagem)
- Venda de Rodas (slug: venda-rodas)
- Reforma de Rodas (slug: reforma-rodas)

**Funilaria e Pintura**
```json
POST /categories/create-child
{
  "name": "Funilaria e Pintura",
  "slug": "funilaria-pintura",
  "description": "Serviços de funilaria e pintura automotiva",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Reparo de Amassados (slug: reparo-amassados)
- Pintura Completa (slug: pintura-completa)
- Pintura Parcial (slug: pintura-parcial)
- Envelopamento (slug: envelopamento)
- Remoção de Amassados (slug: remocao-amassados)

**Vidros e Espelhos**
```json
POST /categories/create-child
{
  "name": "Vidros e Espelhos",
  "slug": "vidros-espelhos",
  "description": "Serviços relacionados a vidros e espelhos",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Troca de Para-brisa (slug: troca-parabrisa)
- Troca de Vidros Laterais (slug: troca-vidros-laterais)
- Pelicula de Proteção (slug: pelicula-protecao)
- Reparo de Vidros (slug: reparo-vidros)
- Espelhos Retrovisores (slug: espelhos-retrovisores)

**Instalação de Acessórios**
```json
POST /categories/create-child
{
  "name": "Instalação de Acessórios",
  "slug": "instalacao-acessorios",
  "description": "Instalação de acessórios automotivos",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Sistema de Som (slug: sistema-som)
- Alarme e Rastreador (slug: alarme-rastreador)
- Central Multimídia (slug: central-multimidia)
- Iluminação LED (slug: iluminacao-led)
- Acessórios de Estética (slug: acessorios-estetica)

**Inspeção e Vistoria**
```json
POST /categories/create-child
{
  "name": "Inspeção e Vistoria",
  "slug": "inspecao-vistoria",
  "description": "Serviços de inspeção e vistoria veicular",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Vistoria Pré-Compra (slug: vistoria-pre-compra)
- Laudo Técnico (slug: laudo-tecnico)
- Inspeção Veicular (slug: inspecao-veicular)
- Avaliação de Veículo (slug: avaliacao-veiculo)

**Despachante Automotivo**
```json
POST /categories/create-child
{
  "name": "Despachante Automotivo",
  "slug": "despachante-automotivo",
  "description": "Serviços de despachante para veículos",
  "parentId": "<ID_DA_CATEGORIA_PAI>"
}
```

**Sub-subcategorias:**
- Transferência de Propriedade (slug: transferencia-propriedade)
- Licenciamento (slug: licenciamento)
- Emplacamento (slug: emplacamento)
- Segunda Via de Documentos (slug: segunda-via-documentos)

---

### 2. BELEZA & ESTÉTICA

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Beleza & Estética",
  "slug": "beleza-estetica",
  "description": "Serviços de beleza, estética e cuidados pessoais"
}
```

#### Subcategorias principais:
- Cabelereiro e Barbeiro (slug: cabelereiro-barbeiro)
- Estética Facial (slug: estetica-facial)
- Estética Corporal (slug: estetica-corporal)
- Depilação (slug: depilacao)
- Unhas e Mãos (slug: unhas-maos)
- Maquiagem (slug: maquiagem)
- Sobrancelhas (slug: sobrancelhas)

---

### 3. SAÚDE

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Saúde",
  "slug": "saude",
  "description": "Serviços e profissionais de saúde"
}
```

#### Subcategorias principais:
- Medicina Geral (slug: medicina-geral)
- Especialidades Médicas (slug: especialidades-medicas)
- Odontologia (slug: odontologia)
- Fisioterapia (slug: fisioterapia)
- Psicologia (slug: psicologia)
- Nutrição (slug: nutricao)
- Enfermagem (slug: enfermagem)
- Farmácia (slug: farmacia)

---

### 4. JURÍDICO

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Jurídico",
  "slug": "juridico",
  "description": "Serviços jurídicos e advocacia"
}
```

#### Subcategorias principais:
- Advocacia Civil (slug: advocacia-civil)
- Advocacia Criminal (slug: advocacia-criminal)
- Advocacia Trabalhista (slug: advocacia-trabalhista)
- Advocacia Empresarial (slug: advocacia-empresarial)
- Direito de Família (slug: direito-familia)
- Direito Imobiliário (slug: direito-imobiliario)
- Consultoria Jurídica (slug: consultoria-juridica)

---

### 5. CONSTRUÇÃO

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Construção",
  "slug": "construcao",
  "description": "Serviços de construção civil e reformas"
}
```

#### Subcategorias principais:
- Construção de Casas (slug: construcao-casas)
- Reformas e Renovações (slug: reformas-renovacoes)
- Instalações Elétricas (slug: instalacoes-eletricas)
- Instalações Hidráulicas (slug: instalacoes-hidraulicas)
- Pintura e Acabamento (slug: pintura-acabamento)
- Alvenaria (slug: alvenaria)
- Telhados e Coberturas (slug: telhados-coberturas)
- Pisos e Revestimentos (slug: pisos-revestimentos)

---

### 6. GASTRONOMIA & FOOD SERVICE

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Gastronomia & Food Service",
  "slug": "gastronomia-food-service",
  "description": "Serviços de alimentação e gastronomia"
}
```

#### Subcategorias principais:
- Restaurantes (slug: restaurantes)
- Delivery e Fast Food (slug: delivery-fast-food)
- Confeitaria (slug: confeitaria)
- Buffet e Eventos (slug: buffet-eventos)
- Cozinha Personalizada (slug: cozinha-personalizada)
- Aulas de Culinária (slug: aulas-culinaria)

---

### 7. EVENTOS

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Eventos",
  "slug": "eventos",
  "description": "Serviços para organização de eventos"
}
```

#### Subcategorias principais:
- Casamentos (slug: casamentos)
- Aniversários (slug: aniversarios)
- Eventos Corporativos (slug: eventos-corporativos)
- Festas de Formatura (slug: festas-formatura)
- Decoração de Eventos (slug: decoracao-eventos)
- Som e Iluminação (slug: som-iluminacao)
- Fotografia de Eventos (slug: fotografia-eventos)
- Buffet para Eventos (slug: buffet-eventos)

---

### 8. PETS

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Pets",
  "slug": "pets",
  "description": "Serviços para animais de estimação"
}
```

#### Subcategorias principais:
- Veterinária (slug: veterinaria)
- Pet Shop (slug: pet-shop)
- Adestramento (slug: adestramento)
- Hospedagem de Pets (slug: hospedagem-pets)
- Passeio de Cães (slug: passeio-caes)
- Banho e Tosa (slug: banho-tosa)
- Pet Sitter (slug: pet-sitter)

---

### 9. EDUCAÇÃO

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Educação",
  "slug": "educacao",
  "description": "Serviços educacionais e ensino"
}
```

#### Subcategorias principais:
- Aulas Particulares (slug: aulas-particulares)
- Cursos Profissionalizantes (slug: cursos-profissionalizantes)
- Idiomas (slug: idiomas)
- Reforço Escolar (slug: reforco-escolar)
- Preparatório para Concursos (slug: preparatorio-concursos)
- Aulas de Música (slug: aulas-musica)
- Aulas de Artes (slug: aulas-artes)
- Tutoria Online (slug: tutoria-online)

---

### 10. TRANSPORTE & MOBILIDADE

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Transporte & Mobilidade",
  "slug": "transporte-mobilidade",
  "description": "Serviços de transporte e mobilidade urbana"
}
```

#### Subcategorias principais:
- Transporte por Aplicativo (slug: transporte-aplicativo)
- Táxi (slug: taxi)
- Transporte Escolar (slug: transporte-escolar)
- Mudanças e Carretos (slug: mudancas-carretos)
- Motoboy (slug: motoboy)
- Aluguel de Veículos (slug: aluguel-veiculos)
- Bicicletas e Patinetes (slug: bicicletas-patinetes)

---

### 11. CASA & MANUTENÇÃO

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Casa & Manutenção",
  "slug": "casa-manutencao",
  "description": "Serviços domésticos e manutenção residencial"
}
```

#### Subcategorias principais:
- Limpeza Residencial (slug: limpeza-residencial)
- Limpeza Pós-Obra (slug: limpeza-pos-obra)
- Jardinagem (slug: jardinagem)
- Piscina (slug: piscina)
- Ar Condicionado (slug: ar-condicionado-residencial)
- Encanador (slug: encanador)
- Eletricista (slug: eletricista-residencial)
- Chaveiro (slug: chaveiro)
- Serralheria (slug: serralheria)
- Vidraceiro (slug: vidraceiro)

---

### 12. COMÉRCIO VAREJO

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Comércio Varejo",
  "slug": "comercio-varejo",
  "description": "Estabelecimentos comerciais e varejo"
}
```

#### Subcategorias principais:
- Supermercados (slug: supermercados)
- Farmácias (slug: farmacias)
- Lojas de Roupas (slug: lojas-roupas)
- Eletrônicos (slug: eletronicos)
- Móveis e Decoração (slug: moveis-decoracao)
- Material de Construção (slug: material-construcao)
- Pet Shop (slug: pet-shop-varejo)
- Livrarias (slug: livrarias)

---

### 13. TECNOLOGIA & SUPORTE

#### Categoria Raiz
```json
POST /categories/create-root
{
  "name": "Tecnologia & Suporte",
  "slug": "tecnologia-suporte",
  "description": "Serviços de tecnologia e suporte técnico"
}
```

#### Subcategorias principais:
- Suporte Técnico (slug: suporte-tecnico)
- Desenvolvimento de Software (slug: desenvolvimento-software)
- Design Gráfico (slug: design-grafico)
- Marketing Digital (slug: marketing-digital)
- Manutenção de Computadores (slug: manutencao-computadores)
- Instalação de Redes (slug: instalacao-redes)
- Segurança Digital (slug: seguranca-digital)
- Consultoria em TI (slug: consultoria-ti)

---

## NOTAS DE IMPORTAÇÃO

1. **Ordem de Importação**: Sempre criar a categoria raiz primeiro, depois as subcategorias de nível 1, depois nível 2, e assim por diante.

2. **ParentId**: Ao criar subcategorias, você precisará do `categoryId` da categoria pai. Use o endpoint `GET /categories/search?term=<slug>` para encontrar o ID.

3. **Slugs**: Todos os slugs são gerados automaticamente se não fornecidos, mas é recomendado usar os slugs sugeridos para consistência.

4. **Validação**: O sistema valida automaticamente a hierarquia e calcula `level` e `path` recursivo.

5. **Total Estimado**: Esta taxonomia contém aproximadamente 200+ categorias em 4 níveis de profundidade.








