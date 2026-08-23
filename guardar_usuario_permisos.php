<?php
// guardar_usuario_permisos.php - Actualizar el grado y fichas asignadas a un usuario
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

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);

    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }

    $usuario_id    = isset($data['usuario_id']) ? intval($data['usuario_id']) : 0;
    $grado         = isset($data['grado']) ? trim($data['grado']) : '';
    $fichas_acceso = isset($data['fichas_acceso']) ? trim($data['fichas_acceso']) : '';
    $rol           = isset($data['rol']) ? strtolower(trim($data['rol'])) : '';

    if ($usuario_id <= 0) {
        echo json_encode([
            "success" => false,
            "mensaje" => "ID de usuario no válido."
        ]);
        exit;
    }

    // Asegurar columnas
    try { $conexion->exec("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS grado VARCHAR(100) DEFAULT 'Todos'"); } catch (Exception $e) {}
    try { $conexion->exec("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fichas_acceso VARCHAR(255) DEFAULT ''"); } catch (Exception $e) {}

    // Actualizar usuario
    if (!empty($rol)) {
        $stmt = $conexion->prepare("UPDATE usuarios SET grado = :grado, fichas_acceso = :fichas, rol = :rol WHERE id = :id");
        $stmt->execute([
            ':grado'  => $grado,
            ':fichas' => $fichas_acceso,
            ':rol'    => $rol,
            ':id'     => $usuario_id
        ]);
    } else {
        $stmt = $conexion->prepare("UPDATE usuarios SET grado = :grado, fichas_acceso = :fichas WHERE id = :id");
        $stmt->execute([
            ':grado'  => $grado,
            ':fichas' => $fichas_acceso,
            ':id'     => $usuario_id
        ]);
    }

    echo json_encode([
        "success" => true,
        "mensaje" => "Permisos de fichas y grado actualizados correctamente para el usuario."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al guardar los permisos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
