<?php
// guardar_usuario_permisos.php - Sincroniza los permisos de un usuario de forma limpia
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

    // Capturamos el ID del usuario
    $usuario_id = 0;
    if (isset($data['usuario_id']))
        $usuario_id = intval($data['usuario_id']);
    elseif (isset($data['id_usuario']))
        $usuario_id = intval($data['id_usuario']);
    elseif (isset($data['id']))
        $usuario_id = intval($data['id']);

    if ($usuario_id <= 0) {
        echo json_encode([
            "success" => false,
            "mensaje" => "ID de usuario no válido."
        ]);
        exit;
    }

    // 1. PASO CLAVE: Borramos todos los permisos anteriores de este usuario para empezar limpios
    $stmtDelete = $conexion->prepare("DELETE FROM permisos_fichas WHERE usuario_id = :usuario_id");
    $stmtDelete->execute([':usuario_id' => $usuario_id]);

    // 2. Capturamos las fichas seleccionadas (puede venir como un array o como un valor único)
    $fichasSeleccionadas = [];
    if (isset($data['fichas_acceso'])) {
        if (is_array($data['fichas_acceso'])) {
            $fichasSeleccionadas = $data['fichas_acceso'];
        } else {
            // Si viene como string separado por comas o un solo número
            $fichasSeleccionadas = explode(',', $data['fichas_acceso']);
        }
    } elseif (isset($data['ficha_id'])) {
        $fichasSeleccionadas = [$data['ficha_id']];
    }

    // 3. Insertamos las nuevas fichas que el admin marcó (si dejó alguna seleccionada)
    if (!empty($fichasSeleccionadas)) {
        $stmtInsert = $conexion->prepare("INSERT INTO permisos_fichas (usuario_id, ficha_id) VALUES (:usuario_id, :ficha_id)");

        foreach ($fichasSeleccionadas as $ficha_id) {
            $ficha_id = intval(trim($ficha_id));
            if ($ficha_id > 0) {
                $stmtInsert->execute([
                    ':usuario_id' => $usuario_id,
                    ':ficha_id' => $ficha_id
                ]);
            }
        }
    }

    echo json_encode([
        "success" => true,
        "mensaje" => "Permisos actualizados correctamente en la base de datos."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al actualizar los permisos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>