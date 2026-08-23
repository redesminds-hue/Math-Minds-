<?php
// guardar_ficha.php - Guardar una ficha en la base de datos de cPanel
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

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);

    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }

    $titulo = isset($data['titulo']) ? trim($data['titulo']) : '';
    $grado = isset($data['grado']) ? trim($data['grado']) : 'Todos';
    $descripcion = isset($data['descripcion']) ? trim($data['descripcion']) : '';
    $ruta_archivo = isset($data['ruta_archivo']) ? trim($data['ruta_archivo']) : (isset($data['enlace']) ? trim($data['enlace']) : '');

    if (empty($titulo)) {
        echo json_encode(["success" => false, "mensaje" => "El título de la ficha es obligatorio."]);
        exit;
    }

    // Usamos los nombres exactos de tu tabla: titulo, grado, descripcion, ruta_archivo
    $stmt = $conexion->prepare("INSERT INTO fichas (titulo, grado, descripcion, ruta_archivo) VALUES (:titulo, :grado, :descripcion, :ruta_archivo)");
    $stmt->execute([
        ':titulo' => $titulo,
        ':grado' => $grado,
        ':descripcion' => $descripcion,
        ':ruta_archivo' => $ruta_archivo
    ]);

    $nuevoID = $conexion->lastInsertId();

    echo json_encode([
        "success" => true,
        "mensaje" => "Ficha creada correctamente.",
        "ficha_id" => $nuevoID
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "mensaje" => "Error al guardar la ficha: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>