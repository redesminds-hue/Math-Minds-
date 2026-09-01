<?php
// obtener_fichas.php
header('Content-Type: application/json; charset=utf-8');
include 'conexion.php';

$rol = isset($_GET['rol']) ? $_GET['rol'] : 'estudiante';
$usuario_id = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;
$carpeta_actual = isset($_GET['carpeta_id']) ? intval($_GET['carpeta_id']) : null;

try {
    $conexion->exec("SET NAMES utf8mb4");
    $carpetas = [];
    $archivos = [];

    // --- 1. OBTENER CARPETAS (Ordenadas numéricamente: 1, 2, 3... 10) ---
    if ($carpeta_actual) {
        $stmt_carpetas = $conexion->prepare("SELECT * FROM carpetas WHERE parent_id = :parent_id ORDER BY CAST(nombre AS UNSIGNED) ASC, nombre ASC");
        $stmt_carpetas->execute([':parent_id' => $carpeta_actual]);
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    } else {
        if ($rol === 'admin') {
            $stmt_carpetas = $conexion->prepare("SELECT * FROM carpetas WHERE parent_id IS NULL ORDER BY CAST(nombre AS UNSIGNED) ASC, nombre ASC");
            $stmt_carpetas->execute();
        } else {
            $stmt_carpetas = $conexion->prepare("
                SELECT c.* FROM carpetas c 
                INNER JOIN permisos_carpetas p ON c.id = p.carpeta_id 
                WHERE c.parent_id IS NULL AND p.usuario_id = :usuario_id
                ORDER BY CAST(c.nombre AS UNSIGNED) ASC, c.nombre ASC
            ");
            $stmt_carpetas->execute([':usuario_id' => $usuario_id]);
        }
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- 2. OBTENER ARCHIVOS (Ordenados numéricamente: 1, 2, 3...) ---
    if ($carpeta_actual) {
        $stmt_archivos = $conexion->prepare("SELECT * FROM archivos WHERE carpeta_id = :carpeta_id ORDER BY CAST(titulo AS UNSIGNED) ASC, titulo ASC, id ASC");
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