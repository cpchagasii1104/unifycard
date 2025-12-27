// BOOT.ts - Arquivo de teste para verificar se o Node está executando
console.log("BOOT FILE EXECUTED");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("PID:", process.pid);

// Teste de setInterval
setInterval(() => {
    console.log("ALIVE", new Date().toISOString());
}, 1000);

// Manter o processo vivo
setTimeout(() => {
    console.log("BOOT test completed - process will exit");
    process.exit(0);
}, 5000);













