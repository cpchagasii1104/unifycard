# SMOKE TEST CHECKLIST - Rede Social Unificard

## Status da Validação

### ✅ Validação de Código
- [x] `npm run validate:all` - Backend tem erros pré-existentes (não relacionados à Rede Social)
- [x] Frontend typecheck - Corrigidos erros específicos da Rede Social
- [x] Linter - Sem erros nos componentes sociais

### ✅ Correções Aplicadas
1. ✅ Adicionadas funções `followActor()` e `unfollowActor()` na API centralizada
2. ✅ Removidas chamadas diretas a `apiFetch` em ProfilePage e CompanyPage
3. ✅ Corrigido tipo `cover_url` (undefined → null) em ProfilePage e CompanyPage
4. ✅ Removida seção de comentários antiga do PostCard (agora usa apenas CommentsDrawer)
5. ✅ Removidas variáveis não utilizadas (`showComments`, `commentContent`, `isSubmittingComment`)
6. ✅ Removido import não utilizado (`confirmCTA`) do SocialFeed2

---

## SMOKE TEST GUIADO

### (A) Feed
- [ ] **A1**: Abrir `/social` → deve carregar feed (sem erro no console)
- [ ] **A2**: Se vazio → deve aparecer "Ainda não há posts…"

### (B) Post
- [ ] **B3**: Criar post simples → aparece imediatamente no topo (sem refresh manual)

### (C) Reação
- [ ] **C4**: Curtir → contador muda
- [ ] **C5**: Descurtir → volta (sem duplicar reação)

### (D) Comentários
- [ ] **D6**: Abrir CommentsDrawer → lista carrega
- [ ] **D7**: Adicionar comentário → aparece na lista sem recarregar página
- [ ] **D8**: Paginação "carregar mais" funciona (se houver)

### (E) Compartilhar
- [ ] **E9**: Clicar compartilhar → copia link e mostra feedback ("Link copiado")

### (F) Votação
- [ ] **F10**: Criar/abrir post de votação → votar → confirma e mostra resultado (ou refetch ok)

### (G) CTA
- [ ] **G11**: Abrir CTA → confirmar → sucesso
- [ ] **G12**: Voltar pro feed → post atualiza (ou pelo menos não quebra)
- [ ] **G13**: Abrir `/ledger` → resumo + histórico carregam
- [ ] **G14**: Confirmar outro CTA → ledger deve atualizar (listener funcionando)

### (H) Perfil/Company
- [ ] **H15**: Clicar no actor do post → abre `/profile/:id` ou `/company/:id`
- [ ] **H16**: Página abre sem tela branca e tem botão voltar

### (I) Eventos
- [ ] **I17**: Seção eventos no feed → clicar "Ver evento" → abre `EventPage`
- [ ] **I18**: Estado (PRE/DURING/POST) aparece e CTA correto aparece

---

## Problemas Conhecidos (Pré-existentes)

### Backend Typecheck
- Erros de typecheck no backend são pré-existentes e não relacionados à Rede Social
- Não bloqueiam funcionalidade, apenas warnings de tipo

### Frontend Typecheck
- Alguns warnings de variáveis não utilizadas em outros componentes (não críticos)
- Erros corrigidos nos componentes sociais

---

## Próximos Passos

1. **Subir servidores**:
   ```bash
   # Backend
   cd backend && npm run dev
   
   # Frontend  
   cd frontend && npm run dev
   ```

2. **Executar smoke test manual** seguindo checklist acima

3. **Reportar falhas** no formato:
   - Item que falhou (ex: D7, G13, H15)
   - Erro do console/response (uma linha)
   - Screenshot (opcional)

---

## Arquivos Modificados (Resumo)

### Backend
- `backend/src/modules/social/social-2.0.service.ts` - Adicionado método `getComments()`
- `backend/src/modules/social/social-2.0.routes.ts` - Adicionada rota `GET /social/posts/:id/comments`

### Frontend
- `frontend/src/api/social.ts` - **NOVO** - API centralizada completa
- `frontend/src/components/social/CommentsDrawer.tsx` - **NOVO** - Drawer de comentários
- `frontend/src/components/social/CommentsDrawer.css` - **NOVO** - Estilos do drawer
- `frontend/src/components/social/SocialFeed2.tsx` - Migrado para API centralizada + correções
- `frontend/src/components/social/PostCard.tsx` - Integrado CommentsDrawer + share real
- `frontend/src/components/social/CTAModal.tsx` - Migrado para API centralizada
- `frontend/src/components/social/SocialLedger.tsx` - Migrado para API centralizada + listener
- `frontend/src/components/social/ProfilePage.tsx` - Migrado para API centralizada + correções
- `frontend/src/components/social/CompanyPage.tsx` - Migrado para API centralizada + correções
- `frontend/src/components/social/SocialFeed2.css` - Adicionado empty-state

---

**Status**: ✅ Código pronto para smoke test manual













