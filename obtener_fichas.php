<?php
// obtener_fichas.php
header('Content-Type: application/json; charset=utf-8');
include 'conexion.php';

$rol = isset($_GET['rol']) ? $_GET['rol'] : 'estudiante';
$usuario_id = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;
$carpeta_actual = isset($_GET['carpeta_id']) ? intval($_GET['carpeta_id']) : null;
$pedir_todas = isset($_GET['todas_carpetas']) ? true : false;

try {
    $conexion->exec("SET NAMES utf8mb4");
    $carpetas = [];
    $archivos = [];

    // Si se solicitan todas las carpetas (para selectores de carpetas)
    if ($pedir_todas) {
        $stmt_todas = $conexion->prepare("
            SELECT id, nombre, parent_id 
            FROM carpetas 
            ORDER BY CAST(nombre AS UNSIGNED) ASC, nombre ASC
        ");
        $stmt_todas->execute();
        $todas = $stmt_todas->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            "success" => true,
            "carpetas" => $todas
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // --- 1. OBTENER CARPETAS ---
    if ($carpeta_actual) {
        // Obtenemos subcarpetas agrupadas para evitar duplicados si se importaron repetidas
        $stmt_carpetas = $conexion->prepare("
            SELECT MIN(id) AS id, nombre, parent_id 
            FROM carpetas 
            WHERE parent_id = :parent_id 
            GROUP BY TRIM(LOWER(nombre)), parent_id 
            ORDER BY CAST(nombre AS UNSIGNED) ASC, nombre ASC
        ");
        $stmt_carpetas->execute([':parent_id' => $carpeta_actual]);
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // En la raíz
        if ($rol === 'admin') {
            $stmt_carpetas = $conexion->prepare("
                SELECT MIN(id) AS id, nombre, parent_id 
                FROM carpetas 
                WHERE parent_id IS NULL 
                GROUP BY TRIM(LOWER(nombre)), parent_id 
                ORDER BY CAST(nombre AS UNSIGNED) ASC, nombre ASC
            ");
            $stmt_carpetas->execute();
        } else {
            $stmt_carpetas = $conexion->prepare("
                SELECT MIN(c.id) AS id, c.nombre, c.parent_id 
                FROM carpetas c 
                INNER JOIN permisos_carpetas p ON (
                    c.id = p.carpeta_id 
                    OR TRIM(LOWER(c.nombre)) IN (SELECT TRIM(LOWER(c2.nombre)) FROM carpetas c2 WHERE c2.id = p.carpeta_id)
                )
                WHERE c.parent_id IS NULL AND p.usuario_id = :usuario_id
                GROUP BY TRIM(LOWER(c.nombre)), c.parent_id
                ORDER BY CAST(c.nombre AS UNSIGNED) ASC, c.nombre ASC
            ");
            $stmt_carpetas->execute([':usuario_id' => $usuario_id]);
        }
        $carpetas = $stmt_carpetas->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- 2. OBTENER ARCHIVOS ---
    if ($carpeta_actual) {
        // Obtenemos los archivos asociados a esta carpeta y a cualquier carpeta homónima duplicada
        $stmt_archivos = $conexion->prepare("
            SELECT DISTINCT a.* 
            FROM archivos a 
            WHERE a.carpeta_id = :carpeta_id 
               OR a.carpeta_id IN (
                    SELECT c_dup.id FROM carpetas c_dup 
                    WHERE TRIM(LOWER(c_dup.nombre)) = (SELECT TRIM(LOWER(c_orig.nombre)) FROM carpetas c_orig WHERE c_orig.id = :carpeta_id2)
                    AND (
                        c_dup.parent_id = (SELECT c_orig2.parent_id FROM carpetas c_orig2 WHERE c_orig2.id = :carpeta_id3)
                        OR (c_dup.parent_id IS NULL AND (SELECT c_orig3.parent_id FROM carpetas c_orig3 WHERE c_orig3.id = :carpeta_id4) IS NULL)
                    )
               )
            ORDER BY CAST(a.titulo AS UNSIGNED) ASC, a.titulo ASC, a.id ASC
        ");
        $stmt_archivos->execute([
            ':carpeta_id' => $carpeta_actual,
            ':carpeta_id2' => $carpeta_actual,
            ':carpeta_id3' => $carpeta_actual,
            ':carpeta_id4' => $carpeta_actual
        ]);
        $rawArchivos = $stmt_archivos->fetchAll(PDO::FETCH_ASSOC);

        // Desduplicar archivos en memoria por título o enlace de archivo
        $archivosUnicos = [];
        $vistosArchivos = [];
        foreach ($rawArchivos as $arch) {
            $clave = trim(mb_strtolower($arch['titulo'] ?? '')) . '|' . trim($arch['ruta_archivo'] ?? '');
            if (!isset($vistosArchivos[$clave])) {
                $vistosArchivos[$clave] = true;
                $archivosUnicos[] = $arch;
            }
        }
        $archivos = $archivosUnicos;
    } else {
        // Si estamos en la raíz y es admin, obtener archivos que no tienen carpeta o están en raíz
        if ($rol === 'admin') {
            $stmt_archivos = $conexion->prepare("
                SELECT DISTINCT a.* 
                FROM archivos a 
                WHERE a.carpeta_id IS NULL OR a.carpeta_id = 0
                ORDER BY CAST(a.titulo AS UNSIGNED) ASC, a.titulo ASC, a.id ASC
            ");
            $stmt_archivos->execute();
            $archivos = $stmt_archivos->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    // Conteos globales para métricas del admin
    $total_fichas = 0;
    $total_carpetas = 0;
    try {
        $stmt_cf = $conexion->query("SELECT COUNT(*) FROM archivos");
        if ($stmt_cf) $total_fichas = intval($stmt_cf->fetchColumn());
        $stmt_cc = $conexion->query("SELECT COUNT(*) FROM carpetas");
        if ($stmt_cc) $total_carpetas = intval($stmt_cc->fetchColumn());
    } catch (Exception $e_count) {}

    echo json_encode([
        "success" => true,
        "carpetas" => $carpetas,
        "archivos" => $archivos,
        "total_fichas" => $total_fichas,
        "total_carpetas" => $total_carpetas
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode(["success" => false, "mensaje" => "Error: " . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>