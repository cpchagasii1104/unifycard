# 🚀 Sistema de Auto-Start do Unificard

Sistema completo para iniciar automaticamente o backend e frontend do Unificard no Windows.

---

## 📁 Arquivos Criados

### Scripts Principais

1. **`start-unificard.ps1`**
   - Inicia backend e frontend em janelas separadas
   - Mata processos Node antigos antes de iniciar
   - Usa pnpm para executar os comandos
   - Auto-restart já configurado (ts-node-dev e Vite)

2. **`stop-unificard.ps1`**
   - Encerra todos os processos Node relacionados
   - Limpa portas 3000 e 5173
   - Remove scripts temporários

3. **`restart-unificard.ps1`**
   - Para e reinicia os servidores
   - Aguarda 2 segundos entre parada e início

4. **`start-unificard-silent.ps1`**
   - Versão silenciosa para uso com Task Scheduler
   - Não mostra janelas durante a inicialização
   - Mesma funcionalidade do script principal

### Documentação

- **`CONFIGURAR_AUTO_START_WINDOWS.md`**
  - Guia completo passo a passo
  - Configuração do Task Scheduler
  - Solução de problemas

---

## 🎯 Uso Rápido

### Iniciar Manualmente

```powershell
.\start-unificard.ps1
```

### Parar

```powershell
.\stop-unificard.ps1
```

### Reiniciar

```powershell
.\restart-unificard.ps1
```

---

## ⚙️ Configurar Auto-Start no Windows

Siga o guia completo em: **`CONFIGURAR_AUTO_START_WINDOWS.md`**

**Resumo rápido:**
1. Abra o **Agendador de Tarefas** (`taskschd.msc`)
2. Crie nova tarefa: **"Unificard Auto-Start"**
3. Configure gatilho: **"Ao fazer logon"**
4. Configure ação: Executar `start-unificard-silent.ps1`
5. Salve e teste

---

## ✅ Funcionalidades

- ✅ **Auto-restart de processos**
  - Backend: ts-node-dev com `--respawn`
  - Frontend: Vite com hot-reload

- ✅ **Limpeza automática**
  - Mata processos Node antigos
  - Libera portas antes de iniciar

- ✅ **Janelas separadas**
  - Backend em uma janela PowerShell
  - Frontend em outra janela PowerShell
  - Fácil de monitorar logs

- ✅ **Auto-start no boot**
  - Configuração via Task Scheduler
  - Inicia automaticamente ao fazer login

---

## 🔧 Requisitos

- Windows 10/11
- PowerShell 5.1 ou superior
- Node.js instalado
- pnpm instalado globalmente (`npm install -g pnpm`)
- Dependências instaladas (`pnpm install`)

---

## 📝 Notas Importantes

1. **Portas utilizadas:**
   - Backend: `3000`
   - Frontend: `5173`

2. **Auto-restart:**
   - Se o backend cair, ts-node-dev reinicia automaticamente
   - Se o frontend cair, Vite reinicia automaticamente
   - Não é necessário configurar nada adicional

3. **Permissões:**
   - Scripts podem precisar de permissão de execução
   - Execute: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

4. **Caminhos:**
   - Scripts assumem que estão na raiz do projeto
   - Ajuste os caminhos no Task Scheduler se necessário

---

## 🐛 Solução de Problemas

### Script não executa

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Porta já em uso

```powershell
.\stop-unificard.ps1
```

### Verificar processos

```powershell
Get-Process | Where-Object {$_.ProcessName -eq "node"}
```

### Verificar portas

```powershell
netstat -ano | findstr "3000"
netstat -ano | findstr "5173"
```

---

## 📚 Documentação Completa

- **Configuração detalhada:** `CONFIGURAR_AUTO_START_WINDOWS.md`
- **Scripts:** `start-unificard.ps1`, `stop-unificard.ps1`, `restart-unificard.ps1`

---

**Última atualização:** 22/12/2025


