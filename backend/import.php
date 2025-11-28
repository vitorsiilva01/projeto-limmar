<?php
// Configuração do banco (mesma do backend)
$host = '127.0.0.1';
$user = 'root';
$pass = '';

try {
    // Conectar sem selecionar banco
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Conectado ao MySQL com sucesso!\n";
    
    // Ler o arquivo SQL
    $sql = file_get_contents(__DIR__ . '/init.sql');
    
    echo "Arquivo init.sql lido. Executando...\n";
    
    // Executar o SQL
    $pdo->exec($sql);
    
    echo "Banco de dados e tabelas criados com sucesso!\n";
    echo "Agora você pode iniciar o backend Node.js\n";
    
} catch(PDOException $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>