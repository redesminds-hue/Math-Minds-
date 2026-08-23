<?php
// obtener_fichas.php - Obtener fichas de trabajo según el rol y permisos del usuario
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
        if (isset($pdo)) $conexion = $pdo;
        elseif (isset($conn)) $conexion = $conn;
        elseif (isset($db)) $conexion = $db;
    }

    // Auto-crear tabla de fichas si no existe
    $conexion->exec("CREATE TABLE IF NOT EXISTS fichas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        area VARCHAR(100) NOT NULL DEFAULT 'Aritmética',
        grado VARCHAR(100) NOT NULL DEFAULT 'Todos',
        descripcion TEXT,
        enlace VARCHAR(500) DEFAULT '#',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Parámetros recibidos
    $rol        = isset($_GET['rol']) ? strtolower(trim($_GET['rol'])) : 'estudiante';
    $grado      = isset($_GET['grado']) ? trim($_GET['grado']) : '';
    $usuario_id = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;
    $email      = isset($_GET['email']) ? trim($_GET['email']) : '';

    $fichas = [];

    if ($rol === 'admin') {
        // Administrador: ver todas las fichas
        $stmt = $conexion->query("SELECT * FROM fichas ORDER BY id DESC");
        $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    } else {
        // Estudiante: buscar qué fichas tiene asignadas
        $fichasPermitidasIDs = [];
        $gradoEstudiante = $grado;

        // Si tenemos el usuario_id o email, consultar sus permisos específicos en la tabla usuarios
        if ($usuario_id > 0 || !empty($email)) {
            $sqlUser = "SELECT * FROM usuarios WHERE " . ($usuario_id > 0 ? "id = :uid" : "LOWER(TRIM(email)) = LOWER(:email)") . " LIMIT 1";
            $stmtUser = $conexion->prepare($sqlUser);
            if ($usuario_id > 0) {
                $stmtUser->bindValue(':uid', $usuario_id, PDO::PARAM_INT);
            } else {
                $stmtUser->bindValue(':email', $email, PDO::PARAM_STR);
            }
            $stmtUser->execute();
            $userData = $stmtUser->fetch(PDO::FETCH_ASSOC);

            if ($userData) {
                if (!empty($userData['grado'])) {
                    $gradoEstudiante = trim($userData['grado']);
                }
                
                // Si tiene el campo fichas_acceso (ej: "1,2,5" o JSON "[1,2,5]")
                $rawAcceso = $userData['fichas_acceso'] ?? $userData['fichas_permitidas'] ?? '';
                if (!empty($rawAcceso)) {
                    if (is_string($rawAcceso) && (strpos($rawAcceso, '[') === 0)) {
                        $fichasPermitidasIDs = json_decode($rawAcceso, true) ?: [];
                    } else {
                        $fichasPermitidasIDs = array_filter(array_map('intval', explode(',', $rawAcceso)));
                    }
                }
            }
        }

        // Consultar fichas según los permisos del administrador:
        if (!empty($fichasPermitidasIDs)) {
            // Si el admin le asignó IDs específicos de fichas
            $placeholders = implode(',', array_fill(0, count($fichasPermitidasIDs), '?'));
            $stmt = $conexion->prepare("SELECT * FROM fichas WHERE id IN ($placeholders) ORDER BY id DESC");
            $stmt->execute($fichasPermitidasIDs);
            $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        } elseif (!empty($gradoEstudiante) && strtolower($gradoEstudiante) !== 'todos') {
            // Si no tiene IDs específicos pero tiene un grado asignado
            $stmt = $conexion->prepare("SELECT * FROM fichas WHERE LOWER(TRIM(grado)) = LOWER(:grado) OR LOWER(TRIM(grado)) = 'todos' ORDER BY id DESC");
            $stmt->execute([':grado' => $gradoEstudiante]);
            $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        } else {
            // Por defecto, fichas generales para todos
            $stmt = $conexion->query("SELECT * FROM fichas WHERE LOWER(TRIM(grado)) = 'todos' OR grado = '' ORDER BY id DESC");
            $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    // Si la tabla fichas está recién creada y vacía, insertar fichas iniciales de muestra para Math Minds
    if (empty($fichas) && $rol === 'admin') {
        $checkCount = $conexion->query("SELECT COUNT(*) FROM fichas")->fetchColumn();
        if ($checkCount == 0) {
            $conexion->exec("INSERT INTO fichas (titulo, area, grado, descripcion, enlace) VALUES
                ('Operaciones con Fracciones y Modelos CPA', 'Aritmética', '6to a 8vo', 'Guía estructurada con el método Singapur y representaciones visuales.', '#'),
                ('Perímetros, Áreas y Polígonos Regulares', 'Geometría', '7mo a 9no', 'Actividades prácticas de cálculo con figuras compuestas y cuadriláteros.', '#'),
                ('Ecuaciones de Primer Grado con Balanzas', 'Álgebra', '8vo a 10mo', 'Resolución de incógnitas con balanzas didácticas y método concreto.', '#'),
                ('Retos Lógicos y Patrones Numéricos', 'Lógica', 'Todos', 'Secuencias numéricas, acertijos espaciales y problemas de deducción.', '#'),
                ('Interpretación de Gráficos Estadísticos', 'Estadística', '6to a 9no', 'Lectura de tablas de frecuencia, diagramas de barras y circulares.', '#');");
            
            $stmt = $conexion->query("SELECT * FROM fichas ORDER BY id DESC");
            $fichas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    echo json_encode([
        "success" => true,
        "total"   => count($fichas),
        "rol"     => $rol,
        "fichas"  => $fichas
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error al obtener las fichas: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
