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

    // Asegurar que la columna activo existe (se crea si no existe)
    try {
        $conexion->exec("ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1");
    } catch (Throwable $ex) { /* Columna ya existe */ }

    // Consultamos los usuarios trayendo su grado y agrupando sus carpetas asignadas
    $sql = "SELECT u.id, u.nombre, u.email, u.rol, 
                   COALESCE(u.grado, '') AS grado, 
                   COALESCE(u.activo, 1) AS activo,
                   COALESCE(GROUP_CONCAT(p.carpeta_id SEPARATOR ','), '') AS carpetas_acceso,
                   COALESCE(GROUP_CONCAT(p.carpeta_id SEPARATOR ','), '') AS fichas_acceso 
            FROM usuarios u
            LEFT JOIN permisos_carpetas p ON u.id = p.usuario_id
            GROUP BY u.id, u.nombre, u.email, u.rol, u.grado, u.activo
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