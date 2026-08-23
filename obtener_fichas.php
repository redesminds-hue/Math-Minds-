<?php
// obtener_fichas.php - Versión estricta de seguridad para estudiantes
header('Content-Type: application/json; charset=utf-8');
include 'conexion.php';

$rol = isset($_GET['rol']) ? $_GET['rol'] : 'estudiante';
$grado = isset($_GET['grado']) ? $_GET['grado'] : '';
$usuario_id = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;

try {
    if ($rol === 'admin') {
        // El administrador ve todas las fichas
        $sql = "SELECT * FROM fichas ORDER BY id DESC";
        $stmt = $conexion->prepare($sql);
        $stmt->execute();
        $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $gradoEstudiante = $grado;
        if ($usuario_id > 0) {
            // Consultar el grado real del estudiante en la base de datos
            $stmtUser = $conexion->prepare("SELECT grado FROM usuarios WHERE id = :uid LIMIT 1");
            $stmtUser->execute([':uid' => $usuario_id]);
            $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($userRow && !empty($userRow['grado'])) {
                $gradoEstudiante = trim($userRow['grado']);
            }

            $sql = "SELECT f.* FROM fichas f
                    INNER JOIN permisos_fichas p ON f.id = p.ficha_id
                    WHERE p.usuario_id = :usuario_id
                    ORDER BY f.id DESC";
            $stmt = $conexion->prepare($sql);
            $stmt->bindParam(':usuario_id', $usuario_id, PDO::PARAM_INT);
            $stmt->execute();
            $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Si no viene el ID de usuario, por seguridad devolvemos cero fichas
            $fichas = [];
        }
    }

    echo json_encode([
        "success" => true,
        "grado"   => $gradoEstudiante ?? $grado,
        "fichas"  => $fichas
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al obtener las fichas: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>