<?php
// ver_archivo.php - Sirve archivos locales o redirige a Google Drive y enlaces web
require_once 'conexion.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$modo = isset($_GET['download']) ? true : false;

if ($id <= 0) {
    die("Archivo no válido.");
}

try {
    $stmt = $conexion->prepare("SELECT ruta_archivo, titulo FROM archivos WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $ficha = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$ficha) {
        die("El archivo no existe en la base de datos.");
    }

    $rutaReal = trim($ficha['ruta_archivo']);

    // 1. Si es un enlace de Google Drive o URL web externa (http:// o https://)
    if (preg_match('/^https?:\/\//i', $rutaReal)) {
        // Extraer ID de Google Drive si es un enlace de Drive
        if (preg_match('/\/file\/d\/([a-zA-Z0-9_-]+)/', $rutaReal, $matches) || preg_match('/[?&]id=([a-zA-Z0-9_-]+)/', $rutaReal, $matches) || preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $rutaReal, $matches)) {
            $driveId = $matches[1];
            if ($modo) {
                header("Location: https://drive.google.com/uc?export=download&id=" . $driveId);
            } else {
                header("Location: https://drive.google.com/file/d/" . $driveId . "/view");
            }
            exit;
        }

        // Redirección directa para otras URLs externas
        header("Location: " . $rutaReal);
        exit;
    }

    // 2. Si es un archivo físico local en el servidor
    if (!empty($rutaReal) && file_exists($rutaReal)) {
        $tipoMime = mime_content_type($rutaReal);
        $disposition = $modo ? 'attachment' : 'inline';

        header('Content-Type: ' . $tipoMime);
        header('Content-Disposition: ' . $disposition . '; filename="' . basename($rutaReal) . '"');
        header('Content-Length: ' . filesize($rutaReal));

        readfile($rutaReal);
        exit;
    } else {
        die("El archivo físico no se encontró en el servidor.");
    }

} catch (Exception $e) {
    die("Error al cargar el archivo.");
}
?>