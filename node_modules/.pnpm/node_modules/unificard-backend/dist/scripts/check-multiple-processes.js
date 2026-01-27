#!/usr/bin/env ts-node
"use strict";
/**
 * Script para verificar se há múltiplos processos do backend rodando
 */
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function checkMultipleProcesses() {
    console.log('🔍 VERIFICANDO MÚLTIPLOS PROCESSOS DO BACKEND');
    console.log('='.repeat(60));
    try {
        // Verificar processos Node.js relacionados ao backend
        const { stdout } = await execAsync('Get-Process | Where-Object { $_.ProcessName -like "*node*" -or $_.ProcessName -like "*ts-node*" } | Select-Object Id, ProcessName, StartTime, Path | Format-Table -AutoSize');
        console.log('Processos Node.js encontrados:');
        console.log(stdout);
        console.log('');
        // Verificar se há processo escutando na porta 3000
        const { stdout: netstat } = await execAsync('netstat -ano | findstr :3000');
        if (netstat.trim()) {
            console.log('Porta 3000 em uso:');
            console.log(netstat);
            console.log('');
            // Extrair PIDs
            const pids = netstat
                .split('\n')
                .map(line => {
                const match = line.match(/\s+(\d+)$/);
                return match ? match[1] : null;
            })
                .filter((pid) => pid !== null)
                .filter((pid, index, self) => self.indexOf(pid) === index);
            if (pids.length > 1) {
                console.warn('⚠️  ATENÇÃO: Múltiplos PIDs encontrados na porta 3000!');
                console.warn(`   PIDs: ${pids.join(', ')}`);
                console.warn('   Isso indica múltiplas instâncias do backend rodando.');
            }
            else if (pids.length === 1) {
                console.log(`✅ Apenas um processo na porta 3000 (PID: ${pids[0]})`);
            }
        }
        else {
            console.log('ℹ️  Nenhum processo encontrado na porta 3000');
        }
    }
    catch (error) {
        console.error('❌ Erro ao verificar processos:', error);
    }
    console.log('='.repeat(60));
}
checkMultipleProcesses().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
