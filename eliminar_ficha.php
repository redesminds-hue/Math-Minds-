<?php
// eliminar_ficha.php - Eliminar ficha por ID en MySQL
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

    $id = isset($data['id']) ? intval($data['id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);

    if ($id <= 0) {
        echo json_encode(["success" => false, "mensaje" => "ID de ficha no válido."]);
        exit;
    }

    $stmt = $conexion->prepare("DELETE FROM fichas WHERE id = :id");
    $stmt->execute([':id' => $id]);

    echo json_encode(["success" => true, "mensaje" => "Ficha eliminada correctamente."], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "mensaje" => "Error al eliminar la ficha: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
