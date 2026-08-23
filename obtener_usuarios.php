<?php
// obtener_usuarios.php - Obtener lista de usuarios reales de la base de datos MySQL
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    require_once 'conexion.php';

    if (!isset($conexion)) {
        if (isset($pdo)) $conexion = $pdo;
        elseif (isset($conn)) $conexion = $conn;
        elseif (isset($db)) $conexion = $db;
    }

    // Asegurar que existan las columnas de grado y fichas_acceso en usuarios
    try {
        $conexion->exec("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS grado VARCHAR(100) DEFAULT 'Todos'");
    } catch (Exception $e) {}

    try {
        $conexion->exec("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fichas_acceso VARCHAR(255) DEFAULT ''");
    } catch (Exception $e) {}

    // Consultar todos los usuarios reales registrados (sin devolver el password)
    $sql = "SELECT id, nombre, email, rol, 
                   COALESCE(grado, 'Sin grado') AS grado, 
                   COALESCE(fichas_acceso, '') AS fichas_acceso 
            FROM usuarios 
            ORDER BY id ASC";
            
    $stmt = $conexion->query($sql);
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success"  => true,
        "total"    => count($usuarios),
        "usuarios" => $usuarios
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al obtener los usuarios: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
