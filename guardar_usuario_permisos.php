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

    // 1. Borramos los permisos de carpetas anteriores de este usuario
    $stmtDelete = $conexion->prepare("DELETE FROM permisos_carpetas WHERE usuario_id = :usuario_id");
    $stmtDelete->execute([':usuario_id' => $usuario_id]);

    // 2. Capturamos las carpetas seleccionadas (puede venir como 'carpetas_acceso' o 'fichas_acceso')
    $carpetasSeleccionadas = [];
    $rawCarpetas = isset($data['carpetas_acceso']) ? $data['carpetas_acceso'] : (isset($data['fichas_acceso']) ? $data['fichas_acceso'] : null);

    if ($rawCarpetas !== null) {
        if (is_array($rawCarpetas)) {
            $carpetasSeleccionadas = $rawCarpetas;
        } else {
            $carpetasSeleccionadas = explode(',', strval($rawCarpetas));
        }
    } elseif (isset($data['carpeta_id'])) {
        $carpetasSeleccionadas = [$data['carpeta_id']];
    }

    // 3. Insertamos las carpetas principales permitidas
    if (!empty($carpetasSeleccionadas)) {
        $stmtInsert = $conexion->prepare("INSERT INTO permisos_carpetas (usuario_id, carpeta_id) VALUES (:usuario_id, :carpeta_id)");

        foreach ($carpetasSeleccionadas as $cid) {
            $cid = intval(trim($cid));
            if ($cid > 0) {
                $stmtInsert->execute([
                    ':usuario_id' => $usuario_id,
                    ':carpeta_id' => $cid
                ]);
            }
        }
    }

    // 4. Actualizamos el grado y rol del usuario si fueron proporcionados
    $grado = isset($data['grado']) ? trim($data['grado']) : null;
    $rol = isset($data['rol']) ? trim($data['rol']) : null;

    if ($grado !== null || $rol !== null) {
        $fields = [];
        $params = [':uid' => $usuario_id];
        if ($grado !== null) {
            $fields[] = "grado = :grado";
            $params[':grado'] = $grado;
        }
        if ($rol !== null) {
            $fields[] = "rol = :rol";
            $params[':rol'] = $rol;
        }
        if (!empty($fields)) {
            $sqlUser = "UPDATE usuarios SET " . implode(", ", $fields) . " WHERE id = :uid";
            $stmtUser = $conexion->prepare($sqlUser);
            $stmtUser->execute($params);
        }
    }

    echo json_encode([
        "success" => true,
        "mensaje" => "Permisos de carpetas actualizados correctamente."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al actualizar los permisos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>