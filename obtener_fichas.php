<?php
// obtener_fichas.php
header('Content-Type: application/json; charset=utf-8');
include 'conexion.php';

$rol = isset($_GET['rol']) ? $_GET['rol'] : 'estudiante';
$usuario_id = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;
$carpeta_actual = isset($_GET['carpeta_id']) ? intval($_GET['carpeta_id']) : null;

try {
    $carpetas = [];
    $archivos = [];

    // --- 1. OBTENER CARPETAS ---
    if ($carpeta_actual) {
        // Si ya está dentro de una carpeta permitida, mostramos sus subcarpetas
        $stmt_carpetas = $conexion->prepare("SELECT * FROM carpetas WHERE parent_id = :parent_id");
        $stmt_carpetas->execute([':parent_id' => $carpeta_actual]);
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Si está en la RAÍZ, filtramos qué carpetas principales puede ver
        if ($rol === 'admin') {
            // El admin ve todas las carpetas principales
            $stmt_carpetas = $conexion->prepare("SELECT * FROM carpetas WHERE parent_id IS NULL");
            $stmt_carpetas->execute();
        } else {
            // El estudiante solo ve las carpetas asignadas en 'permisos_carpetas'
            $stmt_carpetas = $conexion->prepare("
                SELECT c.* FROM carpetas c 
                INNER JOIN permisos_carpetas p ON c.id = p.carpeta_id 
                WHERE c.parent_id IS NULL AND p.usuario_id = :usuario_id
            ");
            $stmt_carpetas->execute([':usuario_id' => $usuario_id]);
        }
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- 2. OBTENER ARCHIVOS ---
    // Solo buscamos archivos si el usuario ya entró a una carpeta
    if ($carpeta_actual) {
        // No necesitamos JOIN de permisos aquí, porque la seguridad ya se aplicó en la carpeta padre
        $stmt_archivos = $conexion->prepare("SELECT * FROM archivos WHERE carpeta_id = :carpeta_id ORDER BY id DESC");
        $stmt_archivos->execute([':carpeta_id' => $carpeta_actual]);
        $archivos = $stmt_archivos->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        "success" => true,
        "carpetas" => $carpetas,
        "archivos" => $archivos
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode(["success" => false, "mensaje" => "Error: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>