<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }
ini_set("display_errors", 0);
try {
    require_once "conexion.php";
    if (!isset($conexion)) { if (isset($pdo)) $conexion=$pdo; elseif (isset($conn)) $conexion=$conn; elseif (isset($db)) $conexion=$db; }
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data && !empty($_POST)) $data = $_POST;
    $id = isset($data["id"]) ? intval($data["id"]) : 0;
    if ($id <= 0) { echo json_encode(["success"=>false,"mensaje"=>"ID de usuario no valido."],JSON_UNESCAPED_UNICODE); exit; }
    // Eliminar permisos primero (integridad referencial)
    $dp = $conexion->prepare("DELETE FROM permisos_fichas WHERE usuario_id=:id");
    $dp->execute([":id"=>$id]);
    // Eliminar usuario
    $du = $conexion->prepare("DELETE FROM usuarios WHERE id=:id");
    $du->execute([":id"=>$id]);
    if ($du->rowCount() > 0) {
        echo json_encode(["success"=>true,"mensaje"=>"Usuario eliminado correctamente."],JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(["success"=>false,"mensaje"=>"No se encontro el usuario con ese ID."],JSON_UNESCAPED_UNICODE);
    }
} catch (Throwable $e) { echo json_encode(["success"=>false,"mensaje"=>"Error: ".$e->getMessage()],JSON_UNESCAPED_UNICODE); }
?>
