<?php
// ver_archivo.php - Sirve archivos de forma segura desde fuera de public_html
require_once 'conexion.php'; // Opcional, por seguridad

// Recibimos el ID de la ficha o el nombre del archivo por GET
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id <= 0) {
    die("Archivo no válido.");
}

try {
    // Buscamos la ruta real en la base de datos
    $stmt = $conexion->prepare("SELECT ruta_archivo, titulo FROM fichas WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $ficha = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$ficha) {
        die("El archivo no existe en la base de datos.");
    }

    $rutaReal = $ficha['ruta_archivo']; // Ej: /home2/mathmind/fichas_pdf/archivo.png

    // Verificamos que el archivo físicamente exista en el servidor
    if (file_exists($rutaReal)) {
        // Detectamos el tipo de archivo (imagen, pdf, etc.)
        $tipoMime = mime_content_type($rutaReal);

        header('Content-Type: ' . $tipoMime);
        header('Content-Disposition: inline; filename="' . basename($rutaReal) . '"');
        header('Content-Length: ' . filesize($rutaReal));

        // Entregamos el archivo al navegador
        readfile($rutaReal);
        exit;
    } else {
        die("El archivo físico no se encontró en el servidor.");
    }

} catch (Exception $e) {
    die("Error al cargar el archivo.");
}
?>