# 🚀 Configurar Auto-Start do Unificard no Windows

Este guia explica como configurar o Unificard para iniciar automaticamente quando o Windows for ligado ou reiniciado.

---

## 📋 Pré-requisitos

- ✅ Scripts PowerShell criados (`start-unificard.ps1`, `stop-unificard.ps1`, `restart-unificard.ps1`)
- ✅ pnpm instalado globalmente
- ✅ Dependências instaladas (`pnpm install` executado na raiz, backend e frontend)
- ✅ Permissões de administrador (para configurar o Task Scheduler)

---

## 🔧 Passo a Passo: Configurar Auto-Start

### Passo 1: Abrir o Agendador de Tarefas (Task Scheduler)

1. Pressione `Win + R` para abrir o Executar
2. Digite: `taskschd.msc`
3. Pressione Enter
4. O Agendador de Tarefas será aberto

**Alternativa:** Pesquise "Agendador de Tarefas" no menu Iniciar

---

### Passo 2: Criar Nova Tarefa

1. No painel direito, clique em **"Criar Tarefa..."**
   - ⚠️ **IMPORTANTE:** Use "Criar Tarefa" (não "Criar Tarefa Básica")
   - Isso permite mais opções de configuração

---

### Passo 3: Configurar a Aba "Geral"

**Nome da tarefa:**
```
Unificard Auto-Start
```

**Descrição:**
```
Inicia automaticamente o backend e frontend do Unificard ao fazer login no Windows
```

**Configurações importantes:**
- ✅ Marque: **"Executar se o usuário estiver conectado ou não"**
- ✅ Marque: **"Executar com privilégios mais altos"** (se necessário)
- ✅ Selecione: **"Configurar para: Windows 10"** (ou sua versão)

---

### Passo 4: Configurar a Aba "Gatilhos"

1. Clique na aba **"Gatilhos"**
2. Clique em **"Novo..."**
3. Configure:
   - **Iniciar a tarefa:** `Ao fazer logon`
   - ✅ Marque: **"Habilitado"**
4. Clique em **"OK"**

**Gatilho adicional (opcional):**
- Você pode adicionar outro gatilho para iniciar quando o computador for ligado
- Clique em **"Novo..."** novamente
- Selecione: **"Ao iniciar"**
- ✅ Marque: **"Habilitado"**
- Clique em **"OK"**

---

### Passo 5: Configurar a Aba "Ações"

1. Clique na aba **"Ações"**
2. Clique em **"Novo..."**
3. Configure:
   - **Ação:** `Iniciar um programa`
   - **Programa/script:** 
     ```
     powershell.exe
     ```
   - **Adicionar argumentos (opcional):**
     ```
     -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\unificard\start-unificard-silent.ps1"
     ```
     ⚠️ **IMPORTANTE:** Substitua `C:\unificard` pelo caminho real do seu projeto!
     ⚠️ **NOTA:** Usamos `start-unificard-silent.ps1` para não abrir janelas desnecessárias no boot
   - **Iniciar em:**
     ```
     C:\unificard
     ```
     ⚠️ **IMPORTANTE:** Substitua `C:\unificard` pelo caminho real do seu projeto!

4. Clique em **"OK"**

---

### Passo 6: Configurar a Aba "Condições" (Opcional)

1. Clique na aba **"Condições"**
2. **Desmarque:** "Iniciar a tarefa somente se o computador estiver conectado à energia CA"
   - Isso permite que a tarefa execute mesmo em laptops na bateria
3. **Marque:** "Acordar o computador para executar esta tarefa" (se desejar)

---

### Passo 7: Configurar a Aba "Configurações" (Importante)

1. Clique na aba **"Configurações"**
2. **Marque:** "Permitir executar a tarefa sob demanda"
3. **Marque:** "Executar a tarefa o mais rápido possível após uma inicialização agendada perdida"
4. **Marque:** "Se a tarefa falhar, reiniciar a cada:"
   - Configure para: `1 minuto`
   - Limite de tentativas: `3`
5. **Marque:** "Se a tarefa em execução não for concluída quando solicitada, force a parada"
   - Configure para: `Não aplicar`

---

### Passo 8: Salvar e Testar

1. Clique em **"OK"** para salvar a tarefa
2. Você pode ser solicitado a inserir sua senha do Windows
3. A tarefa aparecerá na lista de tarefas

**Testar a tarefa:**
1. Clique com o botão direito na tarefa **"Unificard Auto-Start"**
2. Selecione **"Executar"**
3. Verifique se duas janelas do PowerShell abrem (backend e frontend)

---

## 🔍 Verificar se Está Funcionando

### Teste Manual

1. **Reinicie o computador**
2. Após fazer login, aguarde 10-15 segundos
3. Verifique se duas janelas do PowerShell foram abertas:
   - Uma mostrando logs do backend
   - Uma mostrando logs do frontend
4. Acesse:
   - Backend: http://localhost:3000/health
   - Frontend: http://localhost:5173

### Verificar Logs da Tarefa

1. Abra o **Agendador de Tarefas**
2. Clique na tarefa **"Unificard Auto-Start"**
3. Clique na aba **"Histórico"**
4. Verifique se há entradas de execução bem-sucedidas

---

## 🛠️ Solução de Problemas

### Problema: Tarefa não inicia automaticamente

**Soluções:**
1. Verifique se a tarefa está **"Habilitada"** (coluna Status)
2. Verifique os **"Gatilhos"** - devem estar habilitados
3. Verifique o **"Histórico"** da tarefa para ver erros
4. Verifique se o caminho do script está correto (sem espaços, aspas se necessário)

### Problema: Script não executa

**Soluções:**
1. Teste executar o script manualmente:
   ```powershell
   cd C:\unificard
   .\start-unificard.ps1
   ```
2. Verifique a política de execução do PowerShell:
   ```powershell
   Get-ExecutionPolicy
   ```
   Se retornar `Restricted`, execute:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Problema: Portas já em uso

**Soluções:**
1. Execute o script de parada antes de iniciar:
   ```powershell
   .\stop-unificard.ps1
   ```
2. Verifique se há outros processos usando as portas:
   ```powershell
   netstat -ano | findstr "3000"
   netstat -ano | findstr "5173"
   ```

### Problema: Janelas do PowerShell não aparecem

**Soluções:**
1. Verifique se a tarefa está configurada para executar mesmo quando o usuário não está logado
2. Tente configurar para executar apenas quando o usuário fizer login
3. Verifique se há erros no histórico da tarefa

---

## 📝 Comandos Úteis

### Executar tarefa manualmente
```powershell
# Via PowerShell
Start-ScheduledTask -TaskName "Unificard Auto-Start"

# Via Agendador de Tarefas
# Clique com botão direito → Executar
```

### Desabilitar auto-start temporariamente
```powershell
Disable-ScheduledTask -TaskName "Unificard Auto-Start"
```

### Habilitar auto-start novamente
```powershell
Enable-ScheduledTask -TaskName "Unificard Auto-Start"
```

### Remover a tarefa
```powershell
Unregister-ScheduledTask -TaskName "Unificard Auto-Start" -Confirm:$false
```

---

## ✅ Checklist Final

Antes de considerar configurado, verifique:

- [ ] Tarefa criada no Agendador de Tarefas
- [ ] Gatilho configurado para "Ao fazer logon"
- [ ] Caminho do script está correto (sem espaços)
- [ ] Tarefa testada manualmente (botão direito → Executar)
- [ ] Teste de reinicialização realizado
- [ ] Backend e frontend iniciam corretamente após reiniciar
- [ ] Portas 3000 e 5173 estão acessíveis

---

## 🎯 Resultado Esperado

Após configurar corretamente:

1. ✅ Ao **ligar o computador** e fazer login → Backend e frontend iniciam automaticamente
2. ✅ Se o **backend cair** → ts-node-dev reinicia automaticamente (já configurado)
3. ✅ Se o **frontend cair** → Vite reinicia automaticamente (já configurado)
4. ✅ Você só precisa **abrir o navegador** e acessar http://localhost:5173

---

## 📚 Arquivos Relacionados

- `start-unificard.ps1` - Script de inicialização
- `stop-unificard.ps1` - Script de parada
- `restart-unificard.ps1` - Script de reinicialização

---

**Última atualização:** 22/12/2025

