<?php
// obtener_usuarios.php - Obtiene usuarios, sus fichas y su grado exacto
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
        if (isset($pdo))
            $conexion = $pdo;
        elseif (isset($conn))
            $conexion = $conn;
        elseif (isset($db))
            $conexion = $db;
    }

    // Consultamos los usuarios trayendo su grado real y agrupando sus fichas de la tabla relacional
    $sql = "SELECT u.id, u.nombre, u.email, u.rol, 
                   COALESCE(u.grado, '') AS grado, 
                   COALESCE(GROUP_CONCAT(p.ficha_id SEPARATOR ','), '') AS fichas_acceso 
            FROM usuarios u
            LEFT JOIN permisos_fichas p ON u.id = p.usuario_id
            GROUP BY u.id, u.nombre, u.email, u.rol, u.grado
            ORDER BY u.id ASC";

    $stmt = $conexion->query($sql);
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "total" => count($usuarios),
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