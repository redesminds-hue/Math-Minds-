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
    $nombre   = isset($data["nombre"])   ? trim($data["nombre"])   : "";
    $email    = isset($data["email"])    ? trim($data["email"])    : "";
    $password = isset($data["password"]) ? trim($data["password"]) : "";
    $rol      = isset($data["rol"])      ? trim($data["rol"])      : "estudiante";
    $grado    = isset($data["grado"])    ? trim($data["grado"])    : "";
    if (empty($nombre) || empty($email) || empty($password)) { echo json_encode(["success"=>false,"mensaje"=>"Nombre, correo y contrasena son obligatorios."],JSON_UNESCAPED_UNICODE); exit; }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { echo json_encode(["success"=>false,"mensaje"=>"El correo no tiene formato valido."],JSON_UNESCAPED_UNICODE); exit; }
    $chk = $conexion->prepare("SELECT id FROM usuarios WHERE LOWER(TRIM(email))=LOWER(:email) LIMIT 1");
    $chk->execute([":email"=>$email]);
    if ($chk->fetch()) { echo json_encode(["success"=>false,"mensaje"=>"Ya existe un usuario con ese correo."],JSON_UNESCAPED_UNICODE); exit; }
    $st = $conexion->prepare("INSERT INTO usuarios (nombre,email,password,rol,grado,fecha_creacion) VALUES (:nombre,:email,:password,:rol,:grado,NOW())");
    $st->execute([":nombre"=>$nombre,":email"=>$email,":password"=>$password,":rol"=>$rol,":grado"=>$grado]);
    echo json_encode(["success"=>true,"mensaje"=>"Usuario creado correctamente.","usuario_id"=>$conexion->lastInsertId()],JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) { echo json_encode(["success"=>false,"mensaje"=>"Error: ".$e->getMessage()],JSON_UNESCAPED_UNICODE); }
?>
