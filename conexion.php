<?php
// conexion.php - Conexión a la base de datos MySQL en cPanel
$host     = "localhost";
$dbname   = "mathmind_fichasdb";
$username = "mathmind_adminfichas";
$password = "Mathminds2026";

try {
    $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);
    
    // Asignar ambas variables para compatibilidad total
    $conexion = $pdo;

} catch (PDOException $e) {
    // Si la conexión falla, responder en JSON limpio para que no rompa la aplicación
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "success" => false,
        "mensaje" => "Error de conexión con la base de datos MySQL: " . $e->getMessage()
    ]);
    exit;
}
?>