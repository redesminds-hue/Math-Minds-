<?php
// guardar_archivo.php 
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
    if (!isset($conexion)) { /* ... tu lógica de conexión original ... */
    }

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);
    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }

    $titulo = isset($data['titulo']) ? trim($data['titulo']) : '';
    // CAMBIO: Ahora recibimos la carpeta destino en lugar del grado
    $carpeta_id = isset($data['carpeta_id']) ? intval($data['carpeta_id']) : 0;
    $ruta_archivo = isset($data['ruta_archivo']) ? trim($data['ruta_archivo']) : (isset($data['enlace']) ? trim($data['enlace']) : '');

    if (empty($titulo) || $carpeta_id <= 0) {
        echo json_encode(["success" => false, "mensaje" => "El título y la carpeta destino son obligatorios."]);
        exit;
    }

    // CAMBIO: Insertamos en la nueva tabla 'archivos'
    $stmt = $conexion->prepare("INSERT INTO archivos (titulo, ruta_archivo, carpeta_id) VALUES (:titulo, :ruta_archivo, :carpeta_id)");
    $stmt->execute([
        ':titulo' => $titulo,
        ':ruta_archivo' => $ruta_archivo,
        ':carpeta_id' => $carpeta_id
    ]);

    $nuevoID = $conexion->lastInsertId();

    echo json_encode(["success" => true, "mensaje" => "Archivo creado correctamente.", "archivo_id" => $nuevoID], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(["success" => false, "mensaje" => "Error al guardar: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>